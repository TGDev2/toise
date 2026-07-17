import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseConfig } from '../config/firebase.config';
import { UsersModule } from '../users/users.module';
import { CompanyProfilesModule } from '../company-profiles/company-profiles.module';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { AdminGuard } from './guards/admin.guard';

@Global()
@Module({
  imports: [UsersModule, CompanyProfilesModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseConfig,
    FirebaseAuthGuard,
    OptionalAuthGuard,
    AdminGuard,
  ],
  exports: [FirebaseConfig, FirebaseAuthGuard, OptionalAuthGuard, AdminGuard],
})
export class AuthModule {}
