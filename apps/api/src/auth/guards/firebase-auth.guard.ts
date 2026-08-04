import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseConfig } from '../../config/firebase.config';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseConfig) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    let decodedToken;
    try {
      decodedToken = await this.firebase.getAuth().verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request.firebaseUser = decodedToken;

    return true;
  }
}
