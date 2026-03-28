import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingList } from './entities/shopping-list.entity';
import { ComplementaryMaterial } from './entities/complementary-material.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { ProjectsModule } from '../projects/projects.module';
import { EstimationsModule } from '../estimations/estimations.module';
import { UsersModule } from '../users/users.module';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingListsController } from './shopping-lists.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShoppingList, ComplementaryMaterial, WorkType]),
    ProjectsModule,
    EstimationsModule,
    UsersModule,
  ],
  controllers: [ShoppingListsController],
  providers: [ShoppingListsService],
})
export class ShoppingListsModule {}
