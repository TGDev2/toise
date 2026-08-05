import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseConfig } from '../config/firebase.config';
import { UsersService } from '../users/users.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { OrgContextService } from '../organizations/org-context.service';
import { AuthProvider, User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { DataRetentionService } from '../data-retention/data-retention.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly firebase: FirebaseConfig,
    private readonly usersService: UsersService,
    private readonly companyProfilesService: CompanyProfilesService,
    private readonly analyticsService: AnalyticsService,
    private readonly orgContext: OrgContextService,
    private readonly subscriptions: SubscriptionsService,
    private readonly dataRetention: DataRetentionService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: User; message: string }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const auth = this.firebase.getAuth();
    let firebaseUser: { uid: string } | null = null;

    try {
      firebaseUser = await auth.createUser({
        email: dto.email,
        password: dto.password,
        displayName: dto.display_name,
        emailVerified: false,
      });

      const { user, isNewAccount } = await this.usersService.upsertFromFirebase(
        firebaseUser.uid,
        dto.email,
        AuthProvider.EMAIL,
        false,
      );

      if (dto.company_profile) {
        // Le profil d'entreprise appartient à l'organisation (PLAT-4) : on
        // matérialise l'espace personnel du nouveau compte avant de l'y poser.
        const organization =
          await this.orgContext.getOrCreatePersonalOrganization(user);
        await this.companyProfilesService.create(
          organization.id,
          user.id,
          dto.company_profile,
        );
      }

      if (isNewAccount) {
        this.analyticsService.track(
          AnalyticsEventName.ACCOUNT_CREATED,
          user.id,
          {
            auth_provider: user.auth_provider,
          },
        );
      }

      return { user, message: 'Verification email sent' };
    } catch (error) {
      if (firebaseUser) {
        await auth.deleteUser(firebaseUser.uid).catch(() => {
          this.logger.warn(
            `Failed to roll back Firebase user ${firebaseUser?.uid} after registration error`,
          );
        });
      }

      throw error;
    }
  }

  async syncUser(decodedToken: DecodedIdToken): Promise<User> {
    const provider = this.resolveProvider(decodedToken);
    const { user, isNewAccount, isNewGuestSession } =
      await this.usersService.upsertFromFirebase(
        decodedToken.uid,
        decodedToken.email ?? null,
        provider,
        decodedToken.email_verified ?? false,
      );

    if (isNewAccount) {
      this.analyticsService.track(AnalyticsEventName.ACCOUNT_CREATED, user.id, {
        auth_provider: user.auth_provider,
      });
    }

    if (isNewGuestSession) {
      this.analyticsService.track(
        AnalyticsEventName.GUEST_SESSION_STARTED,
        user.id,
        { auth_provider: user.auth_provider },
      );
    }

    return user;
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      await this.firebase.getAuth().generatePasswordResetLink(email);
      this.logger.log(`Password reset link generated for ${email}`);
    } catch {
      // Don't reveal whether email exists
      this.logger.log(`Password reset requested for unknown email: ${email}`);
    }
  }

  async getProfile(firebaseUid: string): Promise<User> {
    const user = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Suppression d'un compte : identité, facturation et propriété
   * organisationnelle traitées comme un tout, dans un ordre qui a un sens.
   *
   * L'implémentation précédente enchaînait deux suppressions — Firebase, puis
   * la ligne `users` — et laissait les clés étrangères faire le reste. Trois
   * conséquences, corrigées ici et verrouillées par la migration
   * 1711468800061 :
   *
   * - **La facturation d'abord.** Rien n'était envoyé à Stripe : l'abonnement
   *   continuait de prélever, et la ligne locale qui portait le
   *   `stripe_customer_id` partait en cascade, supprimant le seul moyen
   *   d'ouvrir le portail. La résiliation est désormais le premier geste, et
   *   son échec interrompt tout.
   * - **Les données collectives ensuite.** Supprimer un propriétaire effaçait
   *   son organisation et, de cascade en cascade, les données de tous ses
   *   membres. La précondition refuse maintenant le cas d'une organisation
   *   partagée.
   * - **L'identité en dernier.** L'ordre était inversé : une panne SQL après
   *   la suppression Firebase laissait les données locales sans principal pour
   *   se réauthentifier, donc sans reprise possible. En terminant par
   *   Firebase, le pire cas est un principal survivant à des données déjà
   *   effacées — la reconnexion recrée un compte vide et la reprise reste
   *   ouverte, ce qui est strictement moins grave que l'inverse.
   *
   * Quatrième conséquence, corrigée par E6-1 : **les fichiers avant les
   * lignes.** `deleteAccountData` efface `project_photos` en cascade, donc les
   * `storage_url` qui étaient le seul moyen de retrouver les photos sur le
   * volume. Les fichiers survivaient à toute suppression de compte, sans
   * qu'aucune passe future ne puisse même les nommer. Un échec d'effacement
   * interrompt désormais l'opération : les lignes restent, la reprise est
   * possible, et rien n'est annoncé qui n'ait été fait.
   */
  async deleteAccount(firebaseUid: string): Promise<void> {
    const user = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ownedOrganizationIds =
      await this.orgContext.collectOrganizationsRemovableWithOwner(user.id);

    await this.subscriptions.cancelForAccountDeletion(user.id);

    await this.dataRetention.eraseOrganizationFiles(ownedOrganizationIds);

    await this.usersService.deleteAccountData(user.id, ownedOrganizationIds);

    try {
      await this.firebase.getAuth().deleteUser(firebaseUid);
    } catch (error) {
      // Les données sont parties, le principal non : l'opération n'est pas
      // complète et ne doit pas être annoncée comme telle. Le `uid` est journalisé
      // pour que la reprise soit possible sans avoir à le retrouver.
      this.logger.error(
        `Données du compte ${user.id} supprimées mais principal Firebase ${firebaseUid} toujours présent`,
      );
      throw error;
    }

    this.logger.log(`Account deleted for user ${user.id}`);
  }

  async mergeGuestAccount(
    targetFirebaseUid: string,
    anonymousFirebaseUid: string,
  ): Promise<User> {
    const targetUser =
      await this.usersService.findByFirebaseUid(targetFirebaseUid);
    const anonymousUser =
      await this.usersService.findByFirebaseUid(anonymousFirebaseUid);

    if (!targetUser || !anonymousUser) {
      throw new NotFoundException('User not found');
    }
    if (targetUser.auth_provider === AuthProvider.ANONYMOUS) {
      throw new ConflictException('Target account must be a registered user');
    }
    if (anonymousUser.auth_provider !== AuthProvider.ANONYMOUS) {
      throw new ConflictException('Only anonymous accounts can be merged');
    }
    if (targetUser.id === anonymousUser.id) {
      throw new ConflictException('Cannot merge an account into itself');
    }

    // La propriété d'un projet est désormais l'organisation (PLAT-4) : ne
    // repointer que `user_id` laisserait le projet fusionné dans l'org de
    // l'invité, donc invisible pour le compte cible.
    const targetOrganization =
      await this.orgContext.getOrCreatePersonalOrganization(targetUser);
    await this.usersService.transferProjects(
      anonymousUser.id,
      targetUser.id,
      targetOrganization.id,
    );

    // Le compte invité s'efface par le même chemin que n'importe quel compte :
    // son espace personnel, désormais vide de projets, ne peut plus partir en
    // cascade depuis `users` (`FK_organizations_owner` est en `RESTRICT` depuis
    // la migration 1711468800061) et doit donc être supprimé explicitement.
    const ownedOrganizationIds =
      await this.orgContext.collectOrganizationsRemovableWithOwner(
        anonymousUser.id,
      );
    // « Vide de projets » n'est vrai que des projets vivants : `transferProjects`
    // filtre sur `deleted_at IS NULL`, donc un projet que l'invité avait supprimé
    // reste dans son organisation et part avec elle. Sans cet appel, ses photos
    // survivraient au volume sans plus aucune ligne pour les désigner — le même
    // défaut que `deleteAccount`, par un chemin plus discret.
    await this.dataRetention.eraseOrganizationFiles(ownedOrganizationIds);
    await this.usersService.deleteAccountData(
      anonymousUser.id,
      ownedOrganizationIds,
    );

    try {
      await this.firebase.getAuth().deleteUser(anonymousFirebaseUid);
    } catch {
      this.logger.warn(
        `Failed to delete anonymous Firebase user ${anonymousFirebaseUid}`,
      );
    }

    return targetUser;
  }

  private resolveProvider(token: DecodedIdToken): AuthProvider {
    const signInProvider = token.firebase?.sign_in_provider;
    if (signInProvider === 'anonymous') {
      return AuthProvider.ANONYMOUS;
    }
    if (signInProvider === 'google.com') {
      return AuthProvider.GOOGLE;
    }
    if (signInProvider === 'apple.com') {
      return AuthProvider.APPLE;
    }
    return AuthProvider.EMAIL;
  }
}
