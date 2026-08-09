import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from './auth.service';
import { FirebaseConfig } from '../config/firebase.config';
import { UsersService } from '../users/users.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { DataRetentionService } from '../data-retention/data-retention.service';
import { STORAGE_PROVIDER } from '../photos/storage/storage.interface';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import {
  AuthProvider,
  SubscriptionTier,
  User,
  UserRole,
} from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;

  const mockFirebaseAuth = {
    createUser: jest.fn(),
    generatePasswordResetLink: jest.fn(),
    deleteUser: jest.fn(),
    verifyIdToken: jest.fn(),
  };

  const usersServiceMock = {
    findByEmail: jest.fn(),
    findByFirebaseUid: jest.fn(),
    upsertFromFirebase: jest.fn(),
    transferProjects: jest.fn(),
    deleteAccountData: jest.fn(),
  };

  const firebaseConfigMock = {
    getAuth: jest.fn(() => mockFirebaseAuth),
  };

  const companyProfilesServiceMock = {
    create: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
  };

  const analyticsServiceMock = {
    track: jest.fn(),
  };

  const subscriptionsMock = {
    cancelForAccountDeletion: jest.fn(),
  };

  const dataRetentionMock = {
    eraseUserFiles: jest.fn().mockResolvedValue(undefined),
  };

  const storageMock = {
    deletePrefix: jest.fn().mockResolvedValue([]),
  };

  let usersService: typeof usersServiceMock;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    auth_provider: AuthProvider.EMAIL,
    subscription_tier: SubscriptionTier.FREE,
    role: UserRole.USER,
    email_verified: false,
    firebase_uid: 'firebase-uid-123',
    referral_code: null,
    referred_by_user_id: null,
    referral_converted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  type DecodedTokenOverrides = Omit<
    Partial<DecodedIdToken>,
    'firebase' | 'uid'
  > &
    Pick<DecodedIdToken, 'uid'> & {
      firebase?: Partial<DecodedIdToken['firebase']>;
    };

  const createDecodedToken = (
    overrides: DecodedTokenOverrides,
  ): DecodedIdToken => {
    const { firebase, uid, ...tokenOverrides } = overrides;

    return {
      aud: 'chiffreo-test',
      auth_time: 0,
      exp: 0,
      iat: 0,
      iss: 'https://securetoken.google.com/chiffreo-test',
      uid,
      sub: uid,
      firebase: {
        identities: {},
        sign_in_provider: 'password',
        ...firebase,
      },
      ...tokenOverrides,
    } as DecodedIdToken;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: FirebaseConfig,
          useValue: firebaseConfigMock,
        },
        {
          provide: CompanyProfilesService,
          useValue: companyProfilesServiceMock,
        },
        {
          provide: AnalyticsService,
          useValue: analyticsServiceMock,
        },
        {
          provide: SubscriptionsService,
          useValue: subscriptionsMock,
        },
        {
          provide: DataRetentionService,
          useValue: dataRetentionMock,
        },
        {
          provide: STORAGE_PROVIDER,
          useValue: storageMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<typeof usersServiceMock>(UsersService);
  });

  describe('register', () => {
    it('should create a new user and return it', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      mockFirebaseAuth.createUser.mockResolvedValue({ uid: 'new-uid' });
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: true,
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'securepass123',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.message).toBe('Verification email sent');
      expect(mockFirebaseAuth.createUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'securepass123',
        displayName: undefined,
        emailVerified: false,
      });
    });

    it('should track account_created for a newly registered user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      mockFirebaseAuth.createUser.mockResolvedValue({ uid: 'new-uid' });
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: true,
      });

      await service.register({
        email: 'test@example.com',
        password: 'securepass123',
      });

      expect(analyticsServiceMock.track).toHaveBeenCalledWith(
        AnalyticsEventName.ACCOUNT_CREATED,
        mockUser.id,
        { auth_provider: mockUser.auth_provider },
      );
    });

    it('should roll back the Firebase user if database sync fails', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      mockFirebaseAuth.createUser.mockResolvedValue({ uid: 'new-uid' });
      usersService.upsertFromFirebase.mockRejectedValue(new Error('db failed'));
      mockFirebaseAuth.deleteUser.mockResolvedValue(undefined);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'securepass123',
        }),
      ).rejects.toThrow('db failed');

      expect(mockFirebaseAuth.deleteUser).toHaveBeenCalledWith('new-uid');
    });

    it('should throw ConflictException if email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'securepass123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('syncUser', () => {
    it('should upsert user from Firebase token', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: false,
      });

      const decodedToken = createDecodedToken({
        uid: 'firebase-uid-123',
        email: 'test@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'password' },
      });

      const result = await service.syncUser(decodedToken);
      expect(result).toEqual(mockUser);
      expect(usersService.upsertFromFirebase).toHaveBeenCalledWith(
        'firebase-uid-123',
        'test@example.com',
        AuthProvider.EMAIL,
        true,
      );
    });

    it('should resolve Google provider correctly', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: false,
      });

      const decodedToken = createDecodedToken({
        uid: 'firebase-uid-123',
        email: 'test@gmail.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      });

      await service.syncUser(decodedToken);
      expect(usersService.upsertFromFirebase).toHaveBeenCalledWith(
        'firebase-uid-123',
        'test@gmail.com',
        AuthProvider.GOOGLE,
        true,
      );
    });

    it('should resolve anonymous provider correctly', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: false,
      });

      const decodedToken = createDecodedToken({
        uid: 'anon-uid',
        email: undefined,
        email_verified: false,
        firebase: { sign_in_provider: 'anonymous' },
      });

      await service.syncUser(decodedToken);
      expect(usersService.upsertFromFirebase).toHaveBeenCalledWith(
        'anon-uid',
        null,
        AuthProvider.ANONYMOUS,
        false,
      );
    });

    it('should track account_created when a new account is created (social signup or guest conversion)', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: true,
      });

      const decodedToken = createDecodedToken({
        uid: 'firebase-uid-123',
        email: 'test@gmail.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      });

      await service.syncUser(decodedToken);

      expect(analyticsServiceMock.track).toHaveBeenCalledWith(
        AnalyticsEventName.ACCOUNT_CREATED,
        mockUser.id,
        { auth_provider: mockUser.auth_provider },
      );
    });

    it('should not track account_created on an ordinary re-login/token refresh', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: false,
      });

      const decodedToken = createDecodedToken({
        uid: 'firebase-uid-123',
        email: 'test@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'password' },
      });

      await service.syncUser(decodedToken);

      expect(analyticsServiceMock.track).not.toHaveBeenCalled();
    });

    it('should track guest_session_started for a brand-new anonymous account (BACKLOG_V1 revenue funnel)', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: false,
        isNewGuestSession: true,
      });

      const decodedToken = createDecodedToken({
        uid: 'anon-uid',
        email: undefined,
        email_verified: false,
        firebase: { sign_in_provider: 'anonymous' },
      });

      await service.syncUser(decodedToken);

      expect(analyticsServiceMock.track).toHaveBeenCalledWith(
        AnalyticsEventName.GUEST_SESSION_STARTED,
        mockUser.id,
        { auth_provider: mockUser.auth_provider },
      );
    });

    it('should not track guest_session_started when an anonymous session merely resumes', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: false,
        isNewGuestSession: false,
      });

      const decodedToken = createDecodedToken({
        uid: 'anon-uid',
        email: undefined,
        email_verified: false,
        firebase: { sign_in_provider: 'anonymous' },
      });

      await service.syncUser(decodedToken);

      expect(analyticsServiceMock.track).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should not throw even if email does not exist', async () => {
      mockFirebaseAuth.generatePasswordResetLink.mockRejectedValue(
        new Error('User not found'),
      );

      await expect(
        service.forgotPassword('unknown@example.com'),
      ).resolves.toBeUndefined();
    });

    it('should generate reset link for existing email', async () => {
      mockFirebaseAuth.generatePasswordResetLink.mockResolvedValue(
        'https://reset.link',
      );

      await service.forgotPassword('test@example.com');
      expect(mockFirebaseAuth.generatePasswordResetLink).toHaveBeenCalledWith(
        'test@example.com',
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      usersService.findByFirebaseUid.mockResolvedValue(mockUser);

      const result = await service.getProfile('firebase-uid-123');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      usersService.findByFirebaseUid.mockResolvedValue(null);

      await expect(service.getProfile('unknown-uid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /**
   * Non-régression du cycle de vie d'une suppression de compte. Chaque test
   * correspond à un scénario où l'implémentation précédente — Firebase, puis
   * `DELETE FROM users`, puis les cascades — produisait un résultat faux.
   */
  describe('deleteAccount', () => {
    beforeEach(() => {
      usersService.findByFirebaseUid.mockResolvedValue(mockUser);
      mockFirebaseAuth.deleteUser.mockResolvedValue(undefined);
      usersService.deleteAccountData.mockResolvedValue(undefined);
      subscriptionsMock.cancelForAccountDeletion.mockResolvedValue(undefined);
      dataRetentionMock.eraseUserFiles.mockResolvedValue(undefined);
    });

    it("résilie l'abonnement Stripe avant d'effacer quoi que ce soit", async () => {
      const order: string[] = [];
      subscriptionsMock.cancelForAccountDeletion.mockImplementation(() => {
        order.push('stripe');
        return Promise.resolve();
      });
      dataRetentionMock.eraseUserFiles.mockImplementation(() => {
        order.push('files');
        return Promise.resolve();
      });
      storageMock.deletePrefix.mockImplementation(() => {
        order.push('exports');
        return Promise.resolve([]);
      });
      usersService.deleteAccountData.mockImplementation(() => {
        order.push('db');
        return Promise.resolve();
      });
      mockFirebaseAuth.deleteUser.mockImplementation(() => {
        order.push('firebase');
        return Promise.resolve();
      });

      await service.deleteAccount('firebase-uid-123');

      expect(subscriptionsMock.cancelForAccountDeletion).toHaveBeenCalledWith(
        mockUser.id,
      );
      // Les fichiers avant les lignes : `deleteAccountData` efface
      // `project_photos` en cascade, donc les `storage_url` qui sont le seul
      // moyen de retrouver les photos sur le volume. Dans l'autre ordre, un
      // échec les rend introuvables pour toujours. Le préfixe d'export (E6-2)
      // suit la même règle, pour la même raison.
      //
      // L'identité part en dernier : une panne en cours de route doit laisser un
      // principal capable de se réauthentifier pour reprendre l'opération.
      expect(order).toEqual(['stripe', 'files', 'exports', 'db', 'firebase']);
      expect(storageMock.deletePrefix).toHaveBeenCalledWith(
        `exports/${mockUser.id}`,
      );
    });

    it('efface les fichiers du seul compte supprimé', async () => {
      await service.deleteAccount('firebase-uid-123');

      expect(dataRetentionMock.eraseUserFiles).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it("n'efface aucune ligne si l'effacement des fichiers échoue", async () => {
      dataRetentionMock.eraseUserFiles.mockRejectedValue(
        new Error('volume indisponible'),
      );

      await expect(service.deleteAccount('firebase-uid-123')).rejects.toThrow(
        'volume indisponible',
      );

      // Les lignes survivent, donc la reprise reste possible : annoncer un
      // effacement qui n'a pas eu lieu est le seul résultat inacceptable.
      expect(usersService.deleteAccountData).not.toHaveBeenCalled();
      expect(mockFirebaseAuth.deleteUser).not.toHaveBeenCalled();
    });

    it("n'efface rien si la résiliation Stripe échoue", async () => {
      subscriptionsMock.cancelForAccountDeletion.mockRejectedValue(
        new Error('stripe down'),
      );

      await expect(service.deleteAccount('firebase-uid-123')).rejects.toThrow(
        'stripe down',
      );

      expect(usersService.deleteAccountData).not.toHaveBeenCalled();
      expect(mockFirebaseAuth.deleteUser).not.toHaveBeenCalled();
    });

    it('supprime le compte sans étape préalable de tenancy', async () => {
      await service.deleteAccount('firebase-uid-123');

      // La précondition « aucune organisation partagée » (un `ConflictException`
      // levé avant toute écriture) a disparu avec les organisations : il n'y a
      // plus de donnée collective à protéger d'une décision individuelle. La
      // suppression prend donc le seul identifiant qui reste.
      expect(usersService.deleteAccountData).toHaveBeenCalledWith(mockUser.id);
      expect(mockFirebaseAuth.deleteUser).toHaveBeenCalledWith(
        'firebase-uid-123',
      );
    });

    it('remonte un échec Firebase survenu après la suppression locale', async () => {
      mockFirebaseAuth.deleteUser.mockRejectedValue(new Error('firebase down'));

      await expect(service.deleteAccount('firebase-uid-123')).rejects.toThrow(
        'firebase down',
      );

      expect(usersService.deleteAccountData).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      usersService.findByFirebaseUid.mockResolvedValue(null);

      await expect(service.deleteAccount('unknown-uid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /**
   * La fusion de compte invité, et la preuve de possession qui lui manquait.
   *
   * L'argument n'est plus un UID mais le **jeton** du compte invité (E6-3) : un
   * UID est public, donc le fournir revenait à désigner l'invité de son choix,
   * dont les projets partaient vers l'appelant et dont le compte était ensuite
   * supprimé. Ces tests vérifient donc deux choses distinctes — que le refus a
   * bien lieu, et surtout qu'**aucun effet de bord destructeur** ne le précède :
   * un 401 rendu après la suppression ne vaudrait rien.
   */
  describe('mergeGuestAccount', () => {
    const anonymousUser: User = {
      ...mockUser,
      id: 'anon-db-id',
      firebase_uid: 'anon-firebase-uid',
      auth_provider: AuthProvider.ANONYMOUS,
      email: null,
    };

    /** Le jeton que l'API rendra pour `GUEST_ID_TOKEN` : un vrai invité. */
    const anonymousToken = createDecodedToken({
      uid: 'anon-firebase-uid',
      firebase: { sign_in_provider: 'anonymous' },
    });

    const GUEST_ID_TOKEN = 'guest-id-token';

    /** Rien n'a été transféré, effacé ni supprimé. */
    const expectNothingDestroyed = () => {
      expect(usersService.transferProjects).not.toHaveBeenCalled();
      expect(usersService.deleteAccountData).not.toHaveBeenCalled();
      expect(dataRetentionMock.eraseUserFiles).not.toHaveBeenCalled();
      expect(storageMock.deletePrefix).not.toHaveBeenCalled();
      expect(mockFirebaseAuth.deleteUser).not.toHaveBeenCalled();
    };

    beforeEach(() => {
      // `clearAllMocks` vide les appels, pas la file des `…Once`. Les tests de
      // refus en empilent qui ne sont jamais consommés — c'est le propre d'un
      // refus précoce — et elles décaleraient les tests suivants d'un cran.
      usersService.findByFirebaseUid.mockReset();
      mockFirebaseAuth.verifyIdToken.mockResolvedValue(anonymousToken);
    });

    /**
     * **Le scénario d'attaque lui-même.** L'appelant est un compte inscrit
     * légitime ; il désigne la session invité d'un tiers, qui existe bel et
     * bien en base et passe donc toutes les gardes de *type* — c'est
     * exactement la situation où l'ancienne implémentation transférait les
     * projets de la victime puis supprimait son compte. Ne lui manque que le
     * jeton : un UID est public, un jeton ne s'obtient qu'en ayant ouvert la
     * session.
     */
    it('refuses a guest account the caller does not control', async () => {
      // La victime existe : rien d'autre que le jeton ne s'oppose à la fusion.
      usersService.findByFirebaseUid
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(anonymousUser);
      mockFirebaseAuth.verifyIdToken.mockRejectedValue(
        new Error('Firebase ID token has invalid signature'),
      );

      await expect(
        service.mergeGuestAccount('firebase-uid-123', 'anon-firebase-uid'),
      ).rejects.toThrow(UnauthorizedException);

      // Le refus précède toute lecture : la cible n'est même pas cherchée.
      expect(usersService.findByFirebaseUid).not.toHaveBeenCalled();
      expectNothingDestroyed();
    });

    /**
     * Variante de la même attaque, jeton valide cette fois : celui du compte
     * inscrit de l'appelant. La ligne en base est truquée en `ANONYMOUS` pour
     * neutraliser la garde de type — le claim reste alors la seule barrière, et
     * c'est bien elle qu'on teste.
     */
    it('refuses a valid token that is not a guest token', async () => {
      usersService.findByFirebaseUid
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(anonymousUser);
      mockFirebaseAuth.verifyIdToken.mockResolvedValue(
        createDecodedToken({
          uid: 'anon-firebase-uid',
          email: 'victime@example.com',
          firebase: { sign_in_provider: 'password' },
        }),
      );

      await expect(
        service.mergeGuestAccount('firebase-uid-123', 'registered-id-token'),
      ).rejects.toThrow(ConflictException);

      expect(usersService.findByFirebaseUid).not.toHaveBeenCalled();
      expectNothingDestroyed();
    });

    it('should transfer projects and delete anonymous user', async () => {
      usersService.findByFirebaseUid
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(anonymousUser);
      usersService.transferProjects.mockResolvedValue(undefined);
      mockFirebaseAuth.deleteUser.mockResolvedValue(undefined);
      usersService.deleteAccountData.mockResolvedValue(undefined);

      const result = await service.mergeGuestAccount(
        'firebase-uid-123',
        GUEST_ID_TOKEN,
      );

      expect(result).toEqual(mockUser);
      // L'UID de l'invité sort du jeton vérifié, jamais d'un champ du corps.
      expect(mockFirebaseAuth.verifyIdToken).toHaveBeenCalledWith(
        GUEST_ID_TOKEN,
      );
      expect(usersService.findByFirebaseUid).toHaveBeenNthCalledWith(
        2,
        'anon-firebase-uid',
      );
      expect(mockFirebaseAuth.deleteUser).toHaveBeenCalledWith(
        'anon-firebase-uid',
      );
      // La propriété est portée par l'organisation (PLAT-4) : le transfert
      // repointe aussi l'org, sans quoi le projet fusionné resterait invisible.
      expect(usersService.transferProjects).toHaveBeenCalledWith(
        'anon-db-id',
        mockUser.id,
      );
      expect(usersService.deleteAccountData).toHaveBeenCalledWith('anon-db-id');
      // `transferProjects` ne déplace que les projets vivants : ceux que
      // l'invité avait supprimés restent les siens et partent avec son compte.
      // Leurs fichiers doivent partir avant, comme pour un compte normal.
      expect(dataRetentionMock.eraseUserFiles).toHaveBeenCalledWith(
        'anon-db-id',
      );
      // Même geste que `deleteAccount` (E6-2) : purge du préfixe d'export de
      // l'invité, pas de celui du compte cible.
      expect(storageMock.deletePrefix).toHaveBeenCalledWith(
        'exports/anon-db-id',
      );
    });

    it('should throw NotFoundException if target user not found', async () => {
      usersService.findByFirebaseUid
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(anonymousUser);

      await expect(
        service.mergeGuestAccount('unknown-uid', GUEST_ID_TOKEN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject merges into another anonymous account', async () => {
      usersService.findByFirebaseUid
        .mockResolvedValueOnce(anonymousUser)
        .mockResolvedValueOnce(anonymousUser);

      await expect(
        service.mergeGuestAccount('anon-firebase-uid', GUEST_ID_TOKEN),
      ).rejects.toThrow(ConflictException);
    });

    /**
     * Le claim dit « anonyme », la ligne en base dit autre chose. La garde en
     * base n'est plus la seule barrière depuis E6-3, mais elle reste la seconde
     * lecture d'une même question, et c'est cette divergence qu'elle couvre.
     */
    it('should reject merges when the source account is not anonymous', async () => {
      usersService.findByFirebaseUid
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);

      await expect(
        service.mergeGuestAccount('firebase-uid-123', GUEST_ID_TOKEN),
      ).rejects.toThrow(ConflictException);
    });
  });
});
