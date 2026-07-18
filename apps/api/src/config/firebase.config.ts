import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseConfig implements OnModuleInit {
  private readonly logger = new Logger(FirebaseConfig.name);

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
      } else if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'Identifiants Firebase manquants (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) : la vérification des tokens est impossible en production.',
        );
      } else {
        // Fallback for development with Firebase Emulator
        this.logger.warn(
          'Identifiants Firebase absents — initialisation en mode émulateur (dev uniquement). La vérification des tokens échouera contre le vrai Firebase.',
        );
        admin.initializeApp({ projectId: projectId ?? 'chiffreo-dev' });
      }
    }
  }

  getAuth(): Auth {
    return admin.auth();
  }
}
