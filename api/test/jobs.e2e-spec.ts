import { randomUUID } from 'node:crypto';
import { JobProcessor } from '../src/jobs/job-processor';
import { TestApp, createTestApp } from './test-app';

describe('Jobs', () => {
  let t: TestApp;
  let processor: JobProcessor;

  beforeAll(async () => {
    t = await createTestApp('jobs');
    processor = t.app.get(JobProcessor);
  });
  afterEach(() => t.reset());
  afterAll(() => t.close());

  function startJob(apiKey: string, kind = 'render', idempotencyKey: string = randomUUID()) {
    return t.http
      .post('/jobs')
      .set('x-api-key', apiKey)
      .set('idempotency-key', idempotencyKey)
      .send({ kind });
  }

  async function balance(apiKey: string): Promise<number> {
    const res = await t.http.get('/me').set('x-api-key', apiKey).expect(200);
    return res.body.balance;
  }

  async function reconcile(apiKey: string) {
    const res = await t.http.get('/me/reconcile').set('x-api-key', apiKey).expect(200);
    return res.body;
  }

  async function listJobs(apiKey: string) {
    const res = await t.http.get('/jobs').set('x-api-key', apiKey).expect(200);
    return res.body as Array<{ id: string; status: string; error: string | null }>;
  }

  describe('creating a job', () => {
    it('charges the cost up front and queues the job', async () => {
      const { apiKey } = await t.createAccount(10);

      const res = await startJob(apiKey).expect(201);

      expect(res.body).toMatchObject({ kind: 'render', cost: 3, status: 'queued' });
      expect(t.queue.enqueued).toEqual([res.body.id]);
      expect(await balance(apiKey)).toBe(7);
    });

    it('returns 402 and writes nothing when the balance is too low', async () => {
      const { apiKey } = await t.createAccount(2);

      await startJob(apiKey).expect(402);

      expect(await balance(apiKey)).toBe(2);
      expect(await listJobs(apiKey)).toHaveLength(0);
      expect(t.queue.enqueued).toHaveLength(0);
    });

    it('rejects a request without an Idempotency-Key', async () => {
      const { apiKey } = await t.createAccount(10);

      await t.http.post('/jobs').set('x-api-key', apiKey).send({ kind: 'render' }).expect(400);
    });

    it('rejects an unknown job kind', async () => {
      const { apiKey } = await t.createAccount(10);

      await startJob(apiKey, 'teleport').expect(400);
    });
  });

  describe('idempotency', () => {
    it('returns the original job when an Idempotency-Key is sent again', async () => {
      const { apiKey } = await t.createAccount(10);

      const first = await startJob(apiKey, 'render', 'retry-key-1').expect(201);
      const again = await startJob(apiKey, 'render', 'retry-key-1').expect(200);

      expect(again.body.id).toBe(first.body.id);
      expect(await balance(apiKey)).toBe(7);
      expect(t.queue.enqueued).toHaveLength(1);
    });

    it('rejects an Idempotency-Key reused for a different kind of job', async () => {
      const { apiKey } = await t.createAccount(10);

      await startJob(apiKey, 'render', 'reused-key').expect(201);
      await startJob(apiKey, 'upscale', 'reused-key').expect(422);
    });

    it('charges once when 20 requests with the same key arrive at once', async () => {
      const { apiKey } = await t.createAccount(10);

      const responses = await Promise.all(
        Array.from({ length: 20 }, () => startJob(apiKey, 'render', 'double-click-key')),
      );

      expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
      expect(responses.filter((r) => r.status === 200)).toHaveLength(19);
      expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);
      expect(await balance(apiKey)).toBe(7);
      expect(t.queue.enqueued).toHaveLength(1);
    });
  });

  describe('concurrency', () => {
    it('never overspends: 50 jobs at once against credits for 33', async () => {
      const { apiKey } = await t.createAccount(100);

      const responses = await Promise.all(Array.from({ length: 50 }, () => startJob(apiKey)));

      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(33);
      expect(statuses.filter((s) => s === 402)).toHaveLength(17);
      expect(await balance(apiKey)).toBe(1);
      expect(await reconcile(apiKey)).toEqual({ balance: 1, ledgerTotal: 1, consistent: true });
    });
  });

  describe('processing', () => {
    it('marks a job succeeded when the render finishes', async () => {
      const { apiKey } = await t.createAccount(10);
      const job = (await startJob(apiKey).expect(201)).body;

      await processor.process(job.id);

      expect((await listJobs(apiKey))[0]).toMatchObject({ id: job.id, status: 'succeeded' });
      expect(await balance(apiKey)).toBe(7);
    });

    it('refunds a job that fails', async () => {
      const { id, apiKey } = await t.createAccount(10);
      const job = (await startJob(apiKey).expect(201)).body;
      t.engine.failWith = 'GPU ran out of memory';

      await processor.process(job.id);

      expect((await listJobs(apiKey))[0]).toMatchObject({
        status: 'failed',
        error: 'GPU ran out of memory',
      });
      expect(await balance(apiKey)).toBe(10);
      expect(await t.countLedgerEntries(id, 'refund')).toBe(1);
    });

    it('refunds once when the same failure is reported twice at the same time', async () => {
      const { id, apiKey } = await t.createAccount(10);
      const job = (await startJob(apiKey).expect(201)).body;

      await Promise.all([processor.fail(job.id, 'timeout'), processor.fail(job.id, 'timeout')]);

      expect(await balance(apiKey)).toBe(10);
      expect(await t.countLedgerEntries(id, 'refund')).toBe(1);
      expect(await reconcile(apiKey)).toEqual({ balance: 10, ledgerTotal: 10, consistent: true });
    });

    it('runs a job once when two workers pick it up', async () => {
      const { apiKey } = await t.createAccount(10);
      const job = (await startJob(apiKey).expect(201)).body;

      await Promise.all([processor.process(job.id), processor.process(job.id)]);

      expect(t.engine.runs).toBe(1);
    });
  });
});
