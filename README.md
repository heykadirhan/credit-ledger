# credit-ledger

[![CI](https://github.com/heykadirhan/credit-ledger/actions/workflows/ci.yml/badge.svg)](https://github.com/heykadirhan/credit-ledger/actions/workflows/ci.yml)

A small NestJS + Next.js app built around a credit ledger. Accounts buy credit packs through a payment webhook and spend the credits on jobs, which can fail and get refunded.

I run a credit system like this in production at QuickStaging, an AI photo tool I built on my own. This repo is a smaller version of it. I wrote it to show how I keep money-like data correct when the same request arrives twice, or when two requests arrive at once. The tests are the main part.

## What the tests check

| Scenario                                                                                                           | What breaks without the safeguard                                                |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| The same payment webhook arrives 50 times at once. The order is credited once.                                     | Providers retry webhooks. A naive handler grants credits on every delivery.      |
| 50 jobs start at once against a balance that covers 33. Exactly 33 start, 17 get a 402, and the balance ends at 1. | A read-then-write balance check lets concurrent requests all pass and overspend. |
| 20 requests share one Idempotency-Key. One job is created and charged once.                                        | A double click or a client retry creates two jobs and charges twice.             |
| The same job failure is reported twice at once. It's refunded once.                                                | Retry logic or a second worker refunds the same job twice.                       |
| Two workers pick up the same job. It runs once.                                                                    | The job runs, and costs us, twice.                                               |
| After each of these, the cached balance equals the sum of the ledger.                                              | The two drift apart and nobody notices.                                          |
| In the UI, a double click sends one request, and a retry after a network error reuses the same key.                | The frontend half of idempotency is missing.                                     |

```bash
npm test
```

The API tests run against a real MongoDB replica set (in memory, through mongodb-memory-server) instead of mocks. These bugs come from how the database handles concurrent writes, and a mock can't reproduce that. To make sure the tests can fail, I broke the code on purpose. Without the balance condition, the overspend test sees all 50 jobs start instead of 33. Without the order status check and the ledger lookup, the unique index still blocks a second credit, but 49 of the 50 deliveries get a 500 instead of a 200, so a real provider would keep retrying.

## How it works

1. Every balance change is a ledger entry. `LedgerService.apply` is the only code that writes `balance`. It updates the balance and inserts the entry in the same MongoDB transaction, so the two can't disagree. `GET /me/reconcile` checks this from a single snapshot.
2. Debits are conditional updates: `findOneAndUpdate({ _id, balance: { $gte: cost } }, { $inc: { balance: -cost } })`. The check and the spend are one atomic operation. When two transactions touch the same account, MongoDB fails one with a write conflict, and Mongoose's `connection.transaction()` retries it against the new balance.
3. Each business event has one idempotency key behind a unique index: `purchase:<orderId>`, `job:<jobId>`, `refund:<jobId>`. Order and job status checks catch repeats first. The index is the backstop.
4. Webhooks are verified with HMAC-SHA256 over the raw request body, compared in constant time. Duplicates still get a 200, because any other status makes the provider retry.
5. Creating a job requires an `Idempotency-Key` header. The web client makes one key per click and keeps it only while it doesn't know whether the request arrived. A repeated key returns the original job with a 200. The same key with a different body gets a 422.

## Layout

```
api/                NestJS 11, Mongoose 8
  src/ledger/       LedgerService, the only code that writes balances
  src/payments/     checkout, signed webhooks, a fake provider for local dev
  src/jobs/         job creation with Idempotency-Key, processing, refunds
  src/accounts/     API key auth (keys are stored as SHA-256 hashes)
  test/             integration tests against a real replica set
web/                Next.js 16 App Router with server actions. The API key stays on the server.
```

## Run it

You need Node 22 or newer. You don't need MongoDB or Docker: `npm run db` starts an in-memory replica set.

```bash
npm install
cp api/.env.example api/.env
cp web/.env.example web/.env
npm run db     # terminal 1
npm run dev    # terminal 2: API on :4000, web on :3000
```

Open http://localhost:3000. The demo account starts with 100 credits. The fake provider sends every payment webhook three times, and about one job in four fails on purpose, so you can watch duplicates get ignored and refunds come in.

## API

| Method | Path                              | Auth                           | Notes                                                                                           |
| ------ | --------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| GET    | `/me`                             | `x-api-key`                    | Name and balance                                                                                |
| GET    | `/me/ledger`                      | `x-api-key`                    | Last 50 entries                                                                                 |
| GET    | `/me/reconcile`                   | `x-api-key`                    | Balance and ledger total, read from one snapshot                                                |
| POST   | `/checkout`                       | `x-api-key`                    | `{ packId }` creates a pending order                                                            |
| POST   | `/webhooks/payments`              | `x-signature`                  | `order.paid` credits the order                                                                  |
| POST   | `/jobs`                           | `x-api-key`, `Idempotency-Key` | `{ kind }`. 201 new, 200 replay, 402 not enough credits, 422 key reused for a different request |
| GET    | `/jobs`                           | `x-api-key`                    | Last 20 jobs                                                                                    |
| POST   | `/dev/fake-provider/pay/:orderId` | `x-api-key`                    | Dev only, needs `FAKE_PROVIDER=true`                                                            |

## Not production-ready yet

- Jobs run in the API process, so a restart loses queued work. I'd move them to a durable queue (BullMQ or SQS) with retries.
- If the process crashes mid-job, the job stays `running` and its credits stay charged. A sweeper that calls `JobProcessor.fail()` on old running jobs would refund them. That's safe to run next to the workers because `fail()` is idempotent.
- Indexes are built at startup. In production I'd manage them with migrations.
- Real providers (Stripe, LemonSqueezy) have their own signature formats and event shapes. The webhook payload here is simplified.
- No rate limiting, pagination or metrics.
