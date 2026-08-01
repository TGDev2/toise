import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { OrgContextService } from './org-context.service';
import type { OrgScope } from './org-context.service';
import { OrganizationsService } from './organizations.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

/**
 * BACKLOG PLAT-4. Seules les routes qui *ajoutent* un membre sont derrière la
 * gate `multi_user` (Contractor Premium) : lire son organisation, en changer ou
 * accepter une invitation doit rester possible à tous les paliers, sinon un
 * salarié au palier `free` ne pourrait jamais entrer dans l'organisation qui,
 * elle, est bien Premium.
 */
@Controller('organizations')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly orgContext: OrgContextService,
  ) {}

  private resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    return this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
  }

  @Get('current')
  async getCurrent(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    return {
      id: scope.organizationId,
      name: scope.organization.name,
      is_personal: scope.organization.is_personal,
      role: scope.role,
      effective_tier: scope.effectiveTier,
    };
  }

  @Get('mine')
  async listMine(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    return this.organizationsService.listMyOrganizations(scope.user);
  }

  @Patch('current')
  async rename(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: UpdateOrganizationDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    const organization = await this.organizationsService.rename(scope, dto);
    return { id: organization.id, name: organization.name };
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async activate(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.organizationsService.switchActiveOrganization(scope.user, id);
  }

  @Get('current/members')
  async listMembers(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    return this.organizationsService.listMembers(scope.organizationId);
  }

  @Patch('current/members/:userId')
  async updateMemberRole(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.organizationsService.updateMemberRole(scope, userId, dto);
  }

  @Delete('current/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.organizationsService.removeMember(scope, userId);
  }

  @Post('current/invitations')
  @RequireFeature('multi_user')
  async invite(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: InviteMemberDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    const invitation = await this.organizationsService.invite(scope, dto);
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expires_at: invitation.expires_at,
    };
  }

  @Get('current/invitations')
  @RequireFeature('multi_user')
  async listInvitations(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    const invitations =
      await this.organizationsService.listPendingInvitations(scope);
    return invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expires_at: i.expires_at,
      created_at: i.created_at,
    }));
  }

  @Delete('current/invitations/:id')
  @RequireFeature('multi_user')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvitation(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.organizationsService.revokeInvitation(scope, id);
  }

  @Post('invitations/accept')
  async acceptInvitation(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: AcceptInvitationDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    const organization = await this.organizationsService.acceptInvitation(
      scope.user,
      dto.token,
    );
    return { id: organization.id, name: organization.name };
  }
}
