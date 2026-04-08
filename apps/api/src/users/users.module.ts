import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Project])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
