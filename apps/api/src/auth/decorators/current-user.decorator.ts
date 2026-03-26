import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';

export const CurrentFirebaseUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DecodedIdToken | null => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ firebaseUser?: DecodedIdToken | null }>();
    const firebaseUser: DecodedIdToken | null = request.firebaseUser ?? null;

    return firebaseUser;
  },
);
