import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const firebaseUser = request.firebaseUser;

    if (!firebaseUser) {
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);

    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    request.appUser = user;
    return true;
  }
}
