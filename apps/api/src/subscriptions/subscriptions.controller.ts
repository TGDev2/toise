import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from './subscriptions.service';
import { RequestRefundDto } from './dto/request-refund.dto';
import { PLANS, REFUND_WINDOW_DAYS } from './plans.constants';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('subscriptions')
@UseGuards(FirebaseAuthGuard)
@SkipThrottle()
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Post('checkout')
  async createCheckout(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() body?: { price_id?: string },
  ): Promise<{ url: string }> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
    return this.subscriptionsService.createCheckoutSession(
      user,
      body?.price_id,
    );
  }

  @Post('portal')
  async createPortal(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
  ): Promise<{ url: string }> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
    return this.subscriptionsService.createPortalSession(user.id);
  }

  @Get('current')
  async getCurrent(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }

    const subscription = await this.subscriptionsService.getSubscription(
      user.id,
    );

    if (!subscription) {
      return { subscription: null };
    }

    return {
      subscription: {
        status: subscription.status,
        stripe_price_id: subscription.stripe_price_id,
        current_period_end: subscription.current_period_end,
        trial_end: subscription.trial_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        // Échéance du délai de grâce sur impayé, calculée ici et non dans le
        // navigateur : rendre `past_due_since` brut obligerait le front à
        // connaître `STRIPE_PAST_DUE_GRACE_DAYS`, donc à en détenir une copie
        // que rien ne garderait alignée sur celle qui est réellement appliquée.
        // `null` hors impayé.
        past_due_grace_ends_at:
          this.subscriptionsService.gracePeriodEndsAt(subscription),
      },
    };
  }

  /**
   * L'abonné peut-il exercer la garantie, et jusqu'à quand ?
   *
   * Route distincte de `current` parce qu'elle coûte un aller-retour Stripe :
   * la greffer sur `current` en ajouterait un à chaque affichage du tableau de
   * bord, et ferait répondre 503 à un écran sans rapport dès que Stripe n'est
   * pas configuré — c'est-à-dire en développement.
   */
  @Get('refund-eligibility')
  async getRefundEligibility(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
  ) {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
    const eligibility = await this.subscriptionsService.getRefundEligibility(
      user.id,
    );
    return { ...eligibility, window_days: REFUND_WINDOW_DAYS };
  }

  /**
   * Exerce le « 30 jours satisfait ou remboursé ».
   *
   * Plafonné malgré le `@SkipThrottle()` de la classe : c'est la seule route du
   * contrôleur qui déplace de l'argent, et l'idempotence en aval ne dispense
   * pas de borner le nombre d'appels Stripe qu'un client peut déclencher.
   */
  @Post('refund')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async requestRefund(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: RequestRefundDto,
  ) {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
    return this.subscriptionsService.requestRefund(user.id, dto.reason);
  }

  @Get('plans')
  getPlans() {
    return {
      plans: PLANS.map(({ priceIdConfigKey, ...plan }) => ({
        ...plan,
        price_id: this.config.get<string>(priceIdConfigKey) ?? null,
      })),
    };
  }
}
