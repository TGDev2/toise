import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { WidgetConfig } from '../entities/widget-config.entity';

/** Configuration posée par `WidgetOriginGuard` — présente sur toute route qu'il protège. */
export const CurrentWidgetConfig = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WidgetConfig => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.widgetConfig as WidgetConfig;
  },
);
