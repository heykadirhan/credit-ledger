import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Connection, Types } from 'mongoose';
import request from 'supertest';
import { AccountsService } from '../src/accounts/accounts.service';
import { AppModule } from '../src/app.module';
import { configureApp, ensureIndexes } from '../src/app.setup';
import { JOB_QUEUE, JobQueue } from '../src/jobs/job-queue';
import { RENDER_ENGINE, RenderEngine } from '../src/jobs/render-engine';

export const TEST_WEBHOOK_SECRET = 'test-webhook-secret';

/** Records job ids so each test decides when a job runs. */
export class ManualJobQueue implements JobQueue {
  readonly enqueued: string[] = [];

  enqueue(jobId: string): void {
    this.enqueued.push(jobId);
  }
}

export class ScriptedRenderEngine implements RenderEngine {
  runs = 0;
  failWith: string | null = null;

  async run(): Promise<void> {
    this.runs++;
    // Yield once so concurrent callers really overlap.
    await new Promise((resolve) => setImmediate(resolve));
    if (this.failWith) throw new Error(this.failWith);
  }
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

// Real AppModule, own database. Only the queue and render engine are fakes.
export async function createTestApp(dbName: string) {
  process.env.MONGO_DB = dbName;
  process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

  const queue = new ManualJobQueue();
  const engine = new ScriptedRenderEngine();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JOB_QUEUE)
    .useValue(queue)
    .overrideProvider(RENDER_ENGINE)
    .useValue(engine)
    .compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await ensureIndexes(app);
  // Real port, so concurrent requests use real HTTP connections.
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  const connection = app.get<Connection>(getConnectionToken());

  return {
    app,
    queue,
    engine,
    connection,
    http: request(`http://127.0.0.1:${port}`),

    async createAccount(credits: number): Promise<{ id: Types.ObjectId; apiKey: string }> {
      const apiKey = randomUUID();
      const account = await app.get(AccountsService).create('Test', apiKey, credits);
      return { id: account._id, apiKey };
    },

    countLedgerEntries(accountId: Types.ObjectId, reason: string): Promise<number> {
      return connection.model('LedgerEntry').countDocuments({ accountId, reason });
    },

    async reset(): Promise<void> {
      // deleteMany, not drop: drop would remove the indexes too.
      await Promise.all(Object.values(connection.collections).map((c) => c.deleteMany({})));
      queue.enqueued.length = 0;
      engine.runs = 0;
      engine.failWith = null;
    },

    close: () => app.close(),
  };
}
