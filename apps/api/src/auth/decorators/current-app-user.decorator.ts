import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../../users/entities/user.entity';

export const CurrentAppUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    return ctx.switchToHttp().getRequest().appUser;
  },
);
