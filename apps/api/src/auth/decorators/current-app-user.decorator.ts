import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../users/entities/user.entity';

export const CurrentAppUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.appUser as User;
  },
);
