import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { demoApiKey } from '../config';
import { AccountsService } from './accounts.service';

/** Creates the demo account on startup when DEMO_API_KEY is set. */
@Injectable()
export class DemoSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoSeed.name);

  constructor(private readonly accounts: AccountsService) {}

  async onApplicationBootstrap(): Promise<void> {
    const apiKey = demoApiKey();
    if (!apiKey || (await this.accounts.findByApiKey(apiKey))) return;
    await this.accounts.create('Demo', apiKey, 100);
    this.logger.log('Created the demo account with 100 credits');
  }
}
