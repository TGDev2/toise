import type { DecodedIdToken } from 'firebase-admin/auth';
import type { User } from '../users/entities/user.entity';
import type { ApiKeyScope } from '../api-keys/api-key-scope';
import type { WidgetScope } from '../widget/widget-scope';
import type { WidgetConfig } from '../widget/entities/widget-config.entity';

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: DecodedIdToken | null;
      appUser?: User;
      /** Portée d'un appel authentifié par clé d'API (PLAT-5), jamais par jeton Firebase. */
      apiKeyScope?: ApiKeyScope;
      /** Portée d'un appel widget (PLAT-7), posée par `WidgetOriginGuard`. */
      widgetScope?: WidgetScope;
      /** Configuration chargée par `WidgetOriginGuard`, évite une seconde requête dans le contrôleur. */
      widgetConfig?: WidgetConfig;
    }
  }
}

export {};
