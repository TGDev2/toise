import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgContextModule } from '../organizations/org-context.module';
import { FeatureGate } from './entities/feature-gate.entity';
import { FeatureGatesService } from './feature-gates.service';
import { FeatureGatesController } from './feature-gates.controller';
import { FeatureGateGuard } from './guards/feature-gate.guard';

/**
 * `OrgContextModule` est **ré-exporté**, et ce n'est pas une commodité.
 *
 * `@UseGuards(FeatureGateGuard)` fait instancier le guard dans l'injecteur du
 * module qui l'applique, pas dans celui qui le fournit : chaque module appelant
 * devait donc importer `OrgContextModule` en plus de celui-ci, sous peine d'un
 * échec de résolution **au démarrage de toute l'application**. Douze modules
 * portaient cette parade ; `CommunityModule` l'avait oubliée, et l'API ne
 * démarrait plus du tout.
 *
 * Le ré-export rend l'oubli impossible : importer `FeatureGatesModule` — ce
 * qu'un module doit de toute façon faire pour obtenir le guard — suffit
 * désormais. Ajouter la treizième copie de la parade aurait laissé la
 * quatorzième à écrire.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FeatureGate]), OrgContextModule],
  controllers: [FeatureGatesController],
  providers: [FeatureGatesService, FeatureGateGuard],
  exports: [FeatureGatesService, FeatureGateGuard, OrgContextModule],
})
export class FeatureGatesModule {}
