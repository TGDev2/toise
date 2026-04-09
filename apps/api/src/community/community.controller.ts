import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { PhotosService } from '../photos/photos.service';
import { CommunityService } from './community.service';
import { CreateCommunityProjectDto } from './dto/create-community-project.dto';
import { ListCommunityQueryDto } from './dto/list-community-query.dto';
import { ModerateCommunityProjectDto } from './dto/moderate-community-project.dto';
import { CreateCommunityCommentDto } from './dto/create-community-comment.dto';

@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly usersService: UsersService,
    private readonly photosService: PhotosService,
  ) {}

  private async resolveUserId(
    firebaseUser: DecodedIdToken | null,
  ): Promise<string | null> {
    if (!firebaseUser) return null;
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    return user?.id ?? null;
  }

  private async requireUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  // ── Admin routes (declared BEFORE :id to avoid conflicts) ──

  @Get('admin/pending')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  async listPending(@Query() query: ListCommunityQueryDto) {
    return this.communityService.listPendingForModeration(
      query.page,
      query.limit,
    );
  }

  @Put('admin/:id/moderate')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  async moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateCommunityProjectDto,
  ) {
    return this.communityService.moderate(id, dto);
  }

  // ── Public routes ──

  @Get()
  @UseGuards(OptionalAuthGuard)
  async listApproved(@Query() query: ListCommunityQueryDto) {
    return this.communityService.listApproved(query);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  async getDetail(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken | null,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.communityService.getApprovedDetail(id, userId);
  }

  @Get(':id/photos/:photoId/file')
  async servePhoto(
    @Param('id', ParseUUIDPipe) communityProjectId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Res() res: Response,
  ): Promise<void> {
    const photo = await this.communityService.findPhotoForCommunityProject(
      communityProjectId,
      photoId,
    );

    const filePath = this.photosService.getFileAbsolutePath(photo.storage_url);
    if (!existsSync(filePath)) {
      res.status(404).json({ message: 'Fichier introuvable' });
      return;
    }

    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    createReadStream(filePath).pipe(res);
  }

  @Get(':id/photos/:photoId/thumbnail')
  async serveThumbnail(
    @Param('id', ParseUUIDPipe) communityProjectId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Res() res: Response,
  ): Promise<void> {
    const photo = await this.communityService.findPhotoForCommunityProject(
      communityProjectId,
      photoId,
    );

    if (!photo.thumbnail_url) {
      res.status(404).json({ message: 'Miniature non disponible' });
      return;
    }

    const filePath = this.photosService.getFileAbsolutePath(
      photo.thumbnail_url,
    );
    if (!existsSync(filePath)) {
      res.status(404).json({ message: 'Fichier introuvable' });
      return;
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    createReadStream(filePath).pipe(res);
  }

  // ── Authenticated routes ──

  @Post()
  @UseGuards(FirebaseAuthGuard, FeatureGateGuard)
  @RequireFeature('community_gallery')
  async submit(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateCommunityProjectDto,
  ) {
    const userId = await this.requireUserId(firebaseUser);
    return this.communityService.submitProject(userId, dto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async withdraw(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const userId = await this.requireUserId(firebaseUser);
    await this.communityService.withdrawProject(userId, id);
  }

  @Post(':id/like')
  @UseGuards(FirebaseAuthGuard)
  async toggleLike(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = await this.requireUserId(firebaseUser);
    return this.communityService.toggleLike(userId, id);
  }

  @Get(':id/comments')
  @UseGuards(OptionalAuthGuard)
  async listComments(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListCommunityQueryDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.communityService.listComments(
      id,
      query.page,
      query.limit,
      userId,
    );
  }

  @Post(':id/comments')
  @UseGuards(FirebaseAuthGuard)
  async addComment(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommunityCommentDto,
  ) {
    const userId = await this.requireUserId(firebaseUser);
    return this.communityService.addComment(userId, id, dto);
  }

  @Delete('comments/:commentId')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    const userId = await this.requireUserId(firebaseUser);
    await this.communityService.deleteComment(userId, commentId);
  }
}
