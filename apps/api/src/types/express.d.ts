import type { DecodedIdToken } from 'firebase-admin/auth';
import type { User } from '../users/entities/user.entity';

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: DecodedIdToken | null;
      appUser?: User;
    }
  }
}

export {};
