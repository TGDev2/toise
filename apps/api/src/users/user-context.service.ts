import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionTier, User } from './entities/user.entity';

/**
 * Portée d'une requête authentifiée : qui agit, et avec quelles capacités.
 * Toutes les lectures et écritures des modules métier se filtrent sur `userId`.
 *
 * Remplace `OrgScope` (PLAT-4), supprimé par E4-1 avec les organisations —
 * ADR 0002 §2 (D3 étendue). Trois champs suffisent là où il en fallait six :
 * `organization`, `organizationId` et `role` n'ont plus d'objet, et
 * `effectiveTier` — le palier du propriétaire de l'organisation — redevient
 * simplement le palier du compte, puisque l'appelant *est* le propriétaire.
 */
export interface UserScope {
  user: User;
  userId: string;
  effectiveTier: SubscriptionTier;
}

/**
 * Résolution de la portée d'une requête authentifiée.
 *
 * Volontairement sans dépendance applicative : ce service est importé par
 * `FeatureGatesModule` et par tous les modules métier. Y ajouter une dépendance
 * (notamment vers les feature gates) recréerait le cycle que
 * `OrgContextModule` était déjà conçu pour éviter.
 *
 * La portée se résout **exclusivement côté serveur**, à partir du seul jeton
 * Firebase vérifié. Aucun en-tête ni paramètre client n'est lu : un
 * identifiant de compte fourni par l'appelant serait une surface d'IDOR sur la
 * totalité des données métier. C'était vrai de l'organisation, ça l'est de
 * l'utilisateur.
 */
@Injectable()
export class UserContextService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async resolveForFirebaseUid(firebaseUid: string): Promise<UserScope> {
    const user = await this.usersRepo.findOne({
      where: { firebase_uid: firebaseUid },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.resolveForUser(user);
  }

  resolveForUser(user: User): UserScope {
    return {
      user,
      userId: user.id,
      effectiveTier: user.subscription_tier,
    };
  }
}
