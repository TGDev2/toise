import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseConfig } from '../../config/firebase.config';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseConfig) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      request.firebaseUser = null;
      return true;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      request.firebaseUser = null;
      return true;
    }

    try {
      request.firebaseUser = await this.firebase.getAuth().verifyIdToken(token);
    } catch {
      request.firebaseUser = null;
    }

    return true;
  }
}
