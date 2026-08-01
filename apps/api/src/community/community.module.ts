import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityProject } from './entities/community-project.entity';
import { CommunityLike } from './entities/community-like.entity';
import { CommunityComment } from './entities/community-comment.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectPhoto } from '../photos/entities/project-photo.entity';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';
import { UsersModule } from '../users/users.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { PhotosModule } from '../photos/photos.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunityProject,
      CommunityLike,
      CommunityComment,
      Project,
      ProjectPhoto,
      ShoppingList,
    ]),
    UsersModule,
    FeatureGatesModule,
    PhotosModule,
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
