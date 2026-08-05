import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * `version` est lue dans l'environnement de l'**image**, figée au build par
   * `ARG APP_VERSION` (cf. `apps/api/Dockerfile`), et non injectée au
   * lancement. La distinction porte tout l'intérêt du champ : une version
   * fournie par `docker compose` attesterait de ce que le compose *croit*
   * déployer, pas de ce que le conteneur exécute — un `pull` qui échoue en
   * silence resterait invisible. Le test de fumée de la CD compare cette
   * valeur au tag publié (`docs/deploy/smoke-test.sh`).
   */
  @Get('health')
  async health(): Promise<{ status: string; version: string }> {
    // Une erreur ici remonte non interceptée : AllExceptionsFilter la traite
    // comme un 500 et la reporte à Sentry, comme toute exception non gérée.
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', version: process.env.APP_VERSION ?? 'dev' };
  }
}
