import { buyPack, startJob } from '@/app/actions';
import { ActionButton } from '@/components/action-button';
import { AutoRefresh } from '@/components/auto-refresh';
import { api } from '@/lib/api';
import {
  JOB_OPTIONS,
  PACK_OPTIONS,
  type JobView,
  type LedgerEntryView,
  type Me,
  type Reconciliation,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

async function loadDashboard() {
  const [me, reconciliation, jobs, ledger] = await Promise.all([
    api<Me>('/me'),
    api<Reconciliation>('/me/reconcile'),
    api<JobView[]>('/jobs'),
    api<LedgerEntryView[]>('/me/ledger'),
  ]);
  return { me, reconciliation, jobs, ledger };
}

export default async function Page() {
  let data: Awaited<ReturnType<typeof loadDashboard>>;
  try {
    data = await loadDashboard();
  } catch (err) {
    return <ApiUnavailable error={err} />;
  }
  const { me, reconciliation, jobs, ledger } = data;
  const jobsInProgress = jobs.some((j) => j.status === 'queued' || j.status === 'running');

  return (
    <main className="page">
      <AutoRefresh active={jobsInProgress} />

      <header className="hero">
        <div>
          <p className="eyebrow">credit-ledger demo</p>
          <h1>{me.name}</h1>
          <p className={reconciliation.consistent ? 'check ok' : 'check error'}>
            {reconciliation.consistent
              ? `Ledger total matches the balance (${reconciliation.ledgerTotal})`
              : `Mismatch: balance ${reconciliation.balance}, ledger ${reconciliation.ledgerTotal}`}
          </p>
        </div>
        <div className="balance">
          <span className="balance-value">{me.balance}</span>
          <span className="balance-label">credits</span>
        </div>
      </header>

      <section className="cards">
        <div className="card">
          <h2>Buy credits</h2>
          <p className="hint">
            The fake provider sends each payment webhook three times at once, like a provider
            retrying. Only one delivery adds credits.
          </p>
          <div className="actions">
            {PACK_OPTIONS.map((pack) => (
              <ActionButton
                key={pack.id}
                label={`${pack.credits} credits · ${pack.price}`}
                action={buyPack.bind(null, pack.id)}
              />
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Run a job</h2>
          <p className="hint">
            Credits are taken when a job starts. About one job in four fails on purpose and is
            refunded.
          </p>
          <div className="actions">
            {JOB_OPTIONS.map((job) => (
              <ActionButton
                key={job.kind}
                label={`${capitalize(job.kind)} · ${job.cost} credit${job.cost === 1 ? '' : 's'}`}
                action={startJob.bind(null, job.kind)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Jobs</h2>
        {jobs.length === 0 ? (
          <p className="empty">No jobs yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Kind</th>
                <th className="num">Cost</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{time(job.createdAt)}</td>
                  <td>{job.kind}</td>
                  <td className="num">{job.cost}</td>
                  <td>
                    <span className={`pill ${job.status}`}>{job.status}</span>
                  </td>
                  <td className="muted">
                    {job.status === 'failed' ? `${job.error} · refunded` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Ledger</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Reason</th>
              <th className="num">Change</th>
              <th className="num">Balance after</th>
              <th>Ref</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((entry) => (
              <tr key={entry.id}>
                <td>{time(entry.createdAt)}</td>
                <td>{entry.reason}</td>
                <td className={`num ${entry.delta > 0 ? 'plus' : 'minus'}`}>
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </td>
                <td className="num">{entry.balanceAfter}</td>
                <td className="muted mono">{entry.refId.slice(-6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function ApiUnavailable({ error }: { error: unknown }) {
  return (
    <main className="page">
      <div className="card">
        <h2>Can&apos;t reach the API</h2>
        <p className="hint">
          Start it with <code>npm run db</code> and <code>npm run dev</code> from the repo root,
          then reload.
        </p>
        <p className="muted mono">{error instanceof Error ? error.message : String(error)}</p>
      </div>
    </main>
  );
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
