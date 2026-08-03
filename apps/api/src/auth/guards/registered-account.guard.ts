import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRES_REGISTERED_ACCOUNT_KEY } from '../decorators/requires-registered-account.decorator';
import { isGuestToken } from '../guest-token';

/**
 * Applique `@RequiresRegisteredAccount()` (E2-1).
 *
 * Ne dépend que du jeton déjà décodé par `FirebaseAuthGuard` : aucune
 * injection, donc aucun module à recâbler pour l'utiliser (cf. `guest-token.ts`
 * et la leçon 19). `Reflector` est fourni par le cœur de Nest, pas par un
 * module métier.
 *
 * À composer **après** `FirebaseAuthGuard`, qui reste seul responsable de
 * l'authentification : `@UseGuards(FirebaseAuthGuard, RegisteredAccountGuard)`.
 * Sans jeton sur la requête, ce garde refuse plutôt que de laisser passer — un
 * ordre de composition erroné doit se voir, pas ouvrir la route.
 */
@Injectable()
export class RegisteredAccountGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_REGISTERED_ACCOUNT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const firebaseUser = request.firebaseUser;
    if (!firebaseUser) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }

    if (isGuestToken(firebaseUser)) {
      throw new ForbiddenException({
        message:
          'Créez votre compte gratuit pour débloquer cette fonctionnalité.',
        error: 'ACCOUNT_REQUIRED',
      });
    }

    return true;
  }
}
