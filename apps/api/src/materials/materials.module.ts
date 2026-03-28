import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MaterialCatalog } from './entities/material-catalog.entity';
import { MaterialPackaging } from './entities/material-packaging.entity';
import { WasteFactor } from './entities/waste-factor.entity';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaterialCatalog, MaterialPackaging, WasteFactor]),
    AuthModule,
    UsersModule,
  ],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
