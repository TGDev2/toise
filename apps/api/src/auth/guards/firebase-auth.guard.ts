import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { FirebaseConfig } from '../../config/firebase.config';
import { SsoSessionService } from '../sso-session.service';
import { SSO_EXEMPT_KEY } from '../decorators/sso-exempt.decorator';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseConfig,
    private readonly ssoSession: SsoSessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    let decodedToken;
    try {
      decodedToken = await this.firebase.getAuth().verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request.firebaseUser = decodedToken;

    // L'enforcement SSO est vérifié ici, et non dans un guard à composer
    // manuellement : ce guard est le seul point que traverse toute requête
    // authentifiée, présente et future, donc la vérification est impossible à
    // oublier sur un nouveau contrôleur (BACKLOG PLAT-6 D8). Coût nul tant
    // qu'aucune organisation n'est en enforcement.
    const exempt = this.reflector.getAllAndOverride<boolean>(SSO_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!exempt) {
      await this.ssoSession.assertSessionAllowed(decodedToken);
    }

    return true;
  }
}
