import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Request } from 'express';
import { AccountDocument } from './account.schema';
import { AccountsService } from './accounts.service';

export interface AuthedRequest extends Request {
  account: AccountDocument;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly accounts: AccountsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const apiKey = req.header('x-api-key');
    const account = apiKey ? await this.accounts.findByApiKey(apiKey) : null;
    if (!account) throw new UnauthorizedException('Missing or invalid API key');
    req.account = account;
    return true;
  }
}

export const CurrentAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccountDocument =>
    context.switchToHttp().getRequest<AuthedRequest>().account,
);
