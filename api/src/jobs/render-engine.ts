import { Injectable } from '@nestjs/common';
import { fakeFailureRate } from '../config';
import { JobKind } from './job.schema';

export const RENDER_ENGINE = Symbol('RENDER_ENGINE');

export interface RenderEngine {
  run(job: { id: string; kind: JobKind }): Promise<void>;
}

@Injectable()
export class FakeRenderEngine implements RenderEngine {
  async run(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1500));
    if (Math.random() < fakeFailureRate()) throw new Error('Render failed (simulated)');
  }
}
