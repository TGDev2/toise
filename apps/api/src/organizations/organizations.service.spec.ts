import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  AuthProvider,
  SubscriptionTier,
  User,
  UserRole,
} from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';
import { Organization } from './entities/organization.entity';
import {
  OrganizationMembership,
  OrganizationRole,
} from './entities/organization-membership.entity';
import { OrganizationInvitation } from './entities/organization-invitation.entity';
import { OrgContextService, OrgScope } from './org-context.service';
import { OrganizationsService } from './organizations.service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'patron@example.com',
    auth_provider: AuthProvider.EMAIL,
    subscription_tier: SubscriptionTier.CONTRACTOR_PREMIUM,
    role: UserRole.USER,
    email_verified: true,
    firebase_uid: 'fb-1',
    referral_code: null,
    referred_by_user_id: null,
    referral_converted_at: null,
    active_organization_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeScope(role: OrganizationRole): OrgScope {
  const user = makeUser();
  return {
    user,
    userId: user.id,
    organization: {
      id: 'org-1',
      name: 'Peinture Dupont',
      owner_user_id: 'user-1',
      is_personal: false,
      owner: null as never,
      created_at: new Date(),
      updated_at: new Date(),
    },
    organizationId: 'org-1',
    role,
    effectiveTier: SubscriptionTier.CONTRACTOR_PREMIUM,
  };
}

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  const orgsRepo = { findOne: jest.fn(), save: jest.fn() };
  const membershipsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const invitationsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  };
  const usersRepo = { findOne: jest.fn(), update: jest.fn() };
  const orgContext = {
    findMembership: jest.fn(),
    getOrCreatePersonalOrganization: jest.fn(),
  };
  const emailService = { sendOrganizationInvitationEmail: jest.fn() };
  const configService = { get: jest.fn().mockReturnValue('https://app.test') };

  beforeEach(async () => {
    jest.clearAllMocks();
    invitationsRepo.create.mockImplementation((v: unknown) => v);
    invitationsRepo.save.mockImplementation((v: unknown) =>
      Promise.resolve({ id: 'inv-1', ...(v as object) }),
    );
    membershipsRepo.create.mockImplementation((v: unknown) => v);
    membershipsRepo.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: getRepositoryToken(Organization), useValue: orgsRepo },
        {
          provide: getRepositoryToken(OrganizationMembership),
          useValue: membershipsRepo,
        },
        {
          provide: getRepositoryToken(OrganizationInvitation),
          useValue: invitationsRepo,
        },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: OrgContextService, useValue: orgContext },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(OrganizationsService);
  });

  describe('matrice des rôles', () => {
    it('refuse à un membre simple la gestion des membres', async () => {
      await expect(
        service.invite(makeScope(OrganizationRole.MEMBER), {
          email: 'salarie@example.com',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('autorise un admin à inviter', async () => {
      await service.invite(makeScope(OrganizationRole.ADMIN), {
        email: 'salarie@example.com',
      });
      expect(invitationsRepo.save).toHaveBeenCalled();
    });

    it('refuse de rétrograder le propriétaire', async () => {
      orgContext.findMembership.mockResolvedValue({
        role: OrganizationRole.OWNER,
      });
      await expect(
        service.updateMemberRole(makeScope(OrganizationRole.ADMIN), 'user-1', {
          role: OrganizationRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuse de retirer le propriétaire', async () => {
      orgContext.findMembership.mockResolvedValue({
        role: OrganizationRole.OWNER,
      });
      await expect(
        service.removeMember(makeScope(OrganizationRole.OWNER), 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('nettoie l’organisation active du membre retiré', async () => {
      orgContext.findMembership.mockResolvedValue({
        id: 'm-1',
        role: OrganizationRole.MEMBER,
      });
      await service.removeMember(makeScope(OrganizationRole.OWNER), 'user-9');
      expect(usersRepo.update).toHaveBeenCalledWith(
        { id: 'user-9', active_organization_id: 'org-1' },
        { active_organization_id: null },
      );
    });
  });

  describe('invitations', () => {
    it('ne stocke que le hash du jeton et envoie le secret par e-mail', async () => {
      await service.invite(makeScope(OrganizationRole.OWNER), {
        email: 'Salarie@Example.com',
      });

      const [saved] = invitationsRepo.save.mock.calls[0] as [
        { token_hash: string; email: string },
      ];
      const [, mailData] = emailService.sendOrganizationInvitationEmail.mock
        .calls[0] as [string, { acceptUrl: string }];
      const token = mailData.acceptUrl.split('/').pop()!;

      expect(saved.email).toBe('salarie@example.com');
      expect(saved.token_hash).toBe(
        createHash('sha256').update(token).digest('hex'),
      );
      expect(saved.token_hash).not.toContain(token);
    });

    it('remplace l’invitation en attente au lieu d’empiler des jetons valides', async () => {
      await service.invite(makeScope(OrganizationRole.OWNER), {
        email: 'salarie@example.com',
      });
      expect(invitationsRepo.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-1',
          email: 'salarie@example.com',
        }),
      );
    });

    it('refuse d’inviter quelqu’un déjà membre', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'm-1' }),
      });
      await expect(
        service.invite(makeScope(OrganizationRole.OWNER), {
          email: 'salarie@example.com',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejette un jeton inconnu', async () => {
      invitationsRepo.findOne.mockResolvedValue(null);
      await expect(
        service.acceptInvitation(makeUser(), 'jeton-bidon'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejette un jeton déjà consommé', async () => {
      invitationsRepo.findOne.mockResolvedValue({
        accepted_at: new Date(),
        expires_at: new Date(Date.now() + 1000),
        email: 'salarie@example.com',
      });
      await expect(
        service.acceptInvitation(makeUser(), 'jeton'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejette une invitation expirée', async () => {
      invitationsRepo.findOne.mockResolvedValue({
        accepted_at: null,
        expires_at: new Date(Date.now() - 1000),
        email: 'patron@example.com',
      });
      await expect(
        service.acceptInvitation(makeUser(), 'jeton'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un compte dont l’e-mail ne correspond pas à l’invitation', async () => {
      // Un jeton intercepté ne doit pas suffire à entrer avec un autre compte.
      invitationsRepo.findOne.mockResolvedValue({
        accepted_at: null,
        expires_at: new Date(Date.now() + 1000),
        email: 'salarie@example.com',
        organization_id: 'org-1',
      });
      await expect(
        service.acceptInvitation(
          makeUser({ email: 'intrus@example.com' }),
          'jeton',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('crée l’adhésion, consomme le jeton et bascule l’utilisateur dans l’organisation', async () => {
      const organization = { id: 'org-1', name: 'Peinture Dupont' };
      invitationsRepo.findOne.mockResolvedValue({
        accepted_at: null,
        expires_at: new Date(Date.now() + 1000),
        email: 'salarie@example.com',
        organization_id: 'org-1',
        role: OrganizationRole.MEMBER,
        organization,
      });
      orgContext.findMembership
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'm-1' });

      const result: Pick<Organization, 'id' | 'name'> =
        await service.acceptInvitation(
          makeUser({ id: 'user-9', email: 'salarie@example.com' }),
          'jeton',
        );

      expect(membershipsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-1',
          user_id: 'user-9',
          role: OrganizationRole.MEMBER,
        }),
      );
      const [consumed] = invitationsRepo.save.mock.calls[0] as [
        { accepted_at: Date | null },
      ];
      expect(consumed.accepted_at).toBeInstanceOf(Date);
      expect(usersRepo.update).toHaveBeenCalledWith('user-9', {
        active_organization_id: 'org-1',
      });
      expect(result).toEqual(organization);
    });
  });

  describe('bascule d’organisation', () => {
    it('refuse une organisation dont l’utilisateur n’est pas membre', async () => {
      orgContext.findMembership.mockResolvedValue(null);
      await expect(
        service.switchActiveOrganization(makeUser(), 'org-tierce'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(usersRepo.update).not.toHaveBeenCalled();
    });
  });
});
