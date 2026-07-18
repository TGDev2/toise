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

  @Get('health')
  async health(): Promise<{ status: string }> {
    // Une erreur ici remonte non interceptée : AllExceptionsFilter la traite
    // comme un 500 et la reporte à Sentry, comme toute exception non gérée.
    await this.dataSource.query('SELECT 1');
    return { status: 'ok' };
  }
}
