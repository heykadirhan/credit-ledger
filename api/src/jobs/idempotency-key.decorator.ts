import { BadRequestException, ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const key = context.switchToHttp().getRequest<Request>().header('idempotency-key');
    if (!key || key.length < 8 || key.length > 128) {
      throw new BadRequestException('Idempotency-Key header is required (8 to 128 characters)');
    }
    return key;
  },
);
