import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ApiKeyScope } from '../api-key-scope';

/** Portée posée par `ApiKeyGuard` — présente sur toute route qu'il protège. */
export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyScope => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.apiKeyScope as ApiKeyScope;
  },
);
