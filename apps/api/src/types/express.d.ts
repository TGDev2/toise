import type { DecodedIdToken } from 'firebase-admin/auth';
import type { User } from '../users/entities/user.entity';
import type { ApiKeyScope } from '../api-keys/api-key-scope';

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: DecodedIdToken | null;
      appUser?: User;
      /** Portée d'un appel authentifié par clé d'API (PLAT-5), jamais par jeton Firebase. */
      apiKeyScope?: ApiKeyScope;
    }
  }
}

export {};
