import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { webhookSecret } from '../config';
import { verifySignature } from './signature';

/** Lets a webhook through only if x-signature is the HMAC of the raw body. */
@Injectable()
export class SignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = req.header('x-signature');
    // Raw bytes: re-serialized JSON might not match what was signed.
    if (!signature || !req.rawBody || !verifySignature(req.rawBody, signature, webhookSecret())) {
      throw new UnauthorizedException('Invalid signature');
    }
    return true;
  }
}
