import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { WasteLearningService } from './waste-learning.service';
import { LearnedWasteFactorDto } from './dto/learned-waste-factor.dto';

/**
 * BACKLOG DATA-3 : inspection et déclenchement manuel de l'apprentissage.
 * Un facteur appris modifie silencieusement le chiffrage de tout le monde —
 * il doit donc être lisible (valeur catalogue de référence, médiane observée,
 * taille d'échantillon, date) sans passer par la base.
 */
@Controller('admin/waste-learning')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class WasteLearningController {
  constructor(private readonly wasteLearningService: WasteLearningService) {}

  @Get()
  async list(): Promise<{ factors: LearnedWasteFactorDto[] }> {
    const factors = await this.wasteLearningService.findAll();
    return {
      factors: factors.map((f) => ({
        material_id: f.material_id,
        pose_type: f.pose_type,
        skill_level: f.skill_level,
        factor_percent: Number(f.factor_percent),
        baseline_percent: Number(f.baseline_percent),
        observed_percent: Number(f.observed_percent),
        sample_size: f.sample_size,
        computed_at: f.computed_at.toISOString(),
      })),
    };
  }

  @Post('run')
  async run() {
    return this.wasteLearningService.run();
  }
}
