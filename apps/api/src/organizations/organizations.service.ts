import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';
import { Organization } from './entities/organization.entity';
import {
  OrganizationMembership,
  OrganizationRole,
} from './entities/organization-membership.entity';
import { OrganizationInvitation } from './entities/organization-invitation.entity';
import { OrgContextService, OrgScope } from './org-context.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

const INVITATION_TTL_DAYS = 7;

export interface MemberView {
  user_id: string;
  email: string | null;
  role: OrganizationRole;
  joined_at: Date;
}

/**
 * Membres, rôles et invitations (BACKLOG PLAT-4).
 *
 * Matrice des droits : `member` travaille sur les données de l'organisation,
 * `admin` gère en plus les membres non-`owner`, `owner` est seul à porter le
 * palier et ne peut être ni rétrogradé ni retiré.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgsRepo: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private readonly membershipsRepo: Repository<OrganizationMembership>,
    @InjectRepository(OrganizationInvitation)
    private readonly invitationsRepo: Repository<OrganizationInvitation>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly orgContext: OrgContextService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async listMembers(organizationId: string): Promise<MemberView[]> {
    const memberships = await this.membershipsRepo.find({
      where: { organization_id: organizationId },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });
    return memberships.map((m) => ({
      user_id: m.user_id,
      email: m.user?.email ?? null,
      role: m.role,
      joined_at: m.created_at,
    }));
  }

  async rename(
    scope: OrgScope,
    dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    this.assertCanManageMembers(scope);
    const organization = await this.getOrganization(scope.organizationId);
    organization.name = dto.name.trim();
    return this.orgsRepo.save(organization);
  }

  // ---------------------------------------------------------------------------
  // Invitations
  // ---------------------------------------------------------------------------

  /**
   * Crée l'invitation et renvoie le jeton **en clair, une seule fois** : seul son
   * SHA-256 est persisté, il n'est donc plus jamais relisible côté serveur.
   */
  async invite(
    scope: OrgScope,
    dto: InviteMemberDto,
  ): Promise<OrganizationInvitation> {
    this.assertCanManageMembers(scope);

    const email = dto.email.trim().toLowerCase();
    const existingMember = await this.membershipsRepo
      .createQueryBuilder('m')
      .innerJoin('m.user', 'u')
      .where('m.organization_id = :organizationId', {
        organizationId: scope.organizationId,
      })
      .andWhere('LOWER(u.email) = :email', { email })
      .getOne();
    if (existingMember) {
      throw new ConflictException(
        'Cette personne fait déjà partie de votre organisation',
      );
    }

    // Un renvoi remplace l'invitation en attente au lieu d'empiler des jetons
    // valides — c'est aussi ce que garantit `UQ_organization_invitations_pending`.
    await this.invitationsRepo.delete({
      organization_id: scope.organizationId,
      email,
      accepted_at: IsNull(),
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

    const invitation = await this.invitationsRepo.save(
      this.invitationsRepo.create({
        organization_id: scope.organizationId,
        email,
        role: dto.role ?? OrganizationRole.MEMBER,
        token_hash: this.hashToken(token),
        invited_by_user_id: scope.userId,
        expires_at: expiresAt,
      }),
    );

    await this.emailService.sendOrganizationInvitationEmail(email, {
      organizationName: scope.organization.name,
      inviterEmail: scope.user.email,
      acceptUrl: `${this.config.get<string>('publicUrl') ?? ''}/invitations/${token}`,
      expiresAt,
    });

    return invitation;
  }

  async listPendingInvitations(
    scope: OrgScope,
  ): Promise<OrganizationInvitation[]> {
    this.assertCanManageMembers(scope);
    return this.invitationsRepo.find({
      where: { organization_id: scope.organizationId, accepted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }

  async revokeInvitation(scope: OrgScope, invitationId: string): Promise<void> {
    this.assertCanManageMembers(scope);
    const invitation = await this.invitationsRepo.findOne({
      where: { id: invitationId, organization_id: scope.organizationId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation introuvable');
    }
    await this.invitationsRepo.remove(invitation);
  }

  /**
   * L'acceptation exige un compte authentifié **dont l'e-mail correspond** à
   * celui invité : un jeton intercepté ne suffit donc pas à entrer dans une
   * organisation avec un compte tiers.
   */
  async acceptInvitation(user: User, token: string): Promise<Organization> {
    const invitation = await this.invitationsRepo.findOne({
      where: { token_hash: this.hashToken(token) },
      relations: ['organization'],
    });

    if (!invitation || invitation.accepted_at) {
      throw new NotFoundException('Invitation invalide ou déjà utilisée');
    }
    if (invitation.expires_at.getTime() < Date.now()) {
      throw new BadRequestException('Invitation expirée');
    }
    if (
      !user.email ||
      user.email.toLowerCase() !== invitation.email.toLowerCase()
    ) {
      throw new ForbiddenException(
        'Cette invitation a été émise pour une autre adresse e-mail',
      );
    }

    const existing = await this.orgContext.findMembership(
      invitation.organization_id,
      user.id,
    );
    if (!existing) {
      await this.membershipsRepo.save(
        this.membershipsRepo.create({
          organization_id: invitation.organization_id,
          user_id: user.id,
          role: invitation.role,
        }),
      );
    }

    invitation.accepted_at = new Date();
    await this.invitationsRepo.save(invitation);

    // On bascule l'utilisateur dans l'organisation qu'il vient de rejoindre :
    // sans cela il resterait dans son espace personnel sans comprendre pourquoi
    // rien n'a changé.
    await this.switchActiveOrganization(user, invitation.organization_id);

    return invitation.organization;
  }

  // ---------------------------------------------------------------------------
  // Membres
  // ---------------------------------------------------------------------------

  async updateMemberRole(
    scope: OrgScope,
    memberUserId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<MemberView> {
    this.assertCanManageMembers(scope);
    const membership = await this.getManageableMembership(scope, memberUserId);
    membership.role = dto.role;
    const saved = await this.membershipsRepo.save(membership);
    const user = await this.usersRepo.findOne({ where: { id: memberUserId } });
    return {
      user_id: saved.user_id,
      email: user?.email ?? null,
      role: saved.role,
      joined_at: saved.created_at,
    };
  }

  async removeMember(scope: OrgScope, memberUserId: string): Promise<void> {
    this.assertCanManageMembers(scope);
    const membership = await this.getManageableMembership(scope, memberUserId);
    await this.membershipsRepo.remove(membership);

    // Le membre retiré retombe sur son espace personnel à la requête suivante ;
    // on nettoie tout de même le pointeur pour ne pas laisser une organisation
    // qui ne le concerne plus dans son profil.
    await this.usersRepo.update(
      { id: memberUserId, active_organization_id: scope.organizationId },
      { active_organization_id: null },
    );
  }

  async listMyOrganizations(user: User): Promise<
    {
      id: string;
      name: string;
      role: OrganizationRole;
      is_personal: boolean;
      is_active: boolean;
    }[]
  > {
    // Garantit que l'espace personnel existe même pour un compte qui n'a
    // jamais rien créé.
    const personal =
      await this.orgContext.getOrCreatePersonalOrganization(user);
    const memberships = await this.membershipsRepo.find({
      where: { user_id: user.id },
      relations: ['organization'],
      order: { created_at: 'ASC' },
    });
    const activeId = user.active_organization_id ?? personal.id;

    return memberships.map((m) => ({
      id: m.organization_id,
      name: m.organization.name,
      role: m.role,
      is_personal: m.organization.is_personal,
      is_active: m.organization_id === activeId,
    }));
  }

  async switchActiveOrganization(
    user: User,
    organizationId: string,
  ): Promise<void> {
    const membership = await this.orgContext.findMembership(
      organizationId,
      user.id,
    );
    if (!membership) {
      throw new ForbiddenException(
        'Vous ne faites pas partie de cette organisation',
      );
    }
    await this.usersRepo.update(user.id, {
      active_organization_id: organizationId,
    });
  }

  // ---------------------------------------------------------------------------

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async getOrganization(organizationId: string): Promise<Organization> {
    const organization = await this.orgsRepo.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organisation introuvable');
    }
    return organization;
  }

  private assertCanManageMembers(scope: OrgScope): void {
    if (
      scope.role !== OrganizationRole.OWNER &&
      scope.role !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Seuls le propriétaire et les administrateurs gèrent les membres',
      );
    }
  }

  /** Le propriétaire n'est ni rétrogradable ni retirable — il porte le palier. */
  private async getManageableMembership(
    scope: OrgScope,
    memberUserId: string,
  ): Promise<OrganizationMembership> {
    const membership = await this.orgContext.findMembership(
      scope.organizationId,
      memberUserId,
    );
    if (!membership) {
      throw new NotFoundException('Membre introuvable');
    }
    if (membership.role === OrganizationRole.OWNER) {
      throw new ForbiddenException(
        "Le propriétaire de l'organisation ne peut pas être modifié",
      );
    }
    return membership;
  }
}
