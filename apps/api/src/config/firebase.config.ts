import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseConfig implements OnModuleInit {
  constructor(private config: ConfigService) {}

  onModuleInit(): void {
    if (admin.apps.length === 0) {
      const projectId = this.config.get<string>('firebase.projectId');
      const clientEmail = this.config.get<string>('firebase.clientEmail');
      const privateKey = this.config.get<string>('firebase.privateKey');

      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        // Fallback for development with Firebase Emulator
        admin.initializeApp({ projectId: projectId ?? 'estimate-dev' });
      }
    }
  }

  getAuth(): Auth {
    return admin.auth();
  }
}
