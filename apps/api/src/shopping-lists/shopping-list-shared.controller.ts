import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingListExportService } from './shopping-list-export.service';
import { shareTokenExpiry } from './share-token';

@Controller('shared/shopping-list')
export class ShoppingListSharedController {
  constructor(
    private readonly shoppingListsService: ShoppingListsService,
    private readonly exportService: ShoppingListExportService,
  ) {}

  @Get(':token')
  async getByToken(@Param('token') token: string) {
    const shoppingList =
      await this.shoppingListsService.findByShareToken(token);
    const project = shoppingList.project;

    return {
      project_name: project.name,
      room_name: project.room_name,
      dimensions: project.dimensions
        ? {
            length_cm: project.dimensions.length_cm,
            width_cm: project.dimensions.width_cm,
            height_cm: project.dimensions.height_cm,
          }
        : null,
      material_items: shoppingList.items_json.material_items,
      complementary_items: shoppingList.items_json.complementary_items.filter(
        (c) => !c.is_removed,
      ),
      created_at: shoppingList.created_at.toISOString(),
      updated_at: shoppingList.updated_at.toISOString(),
      expires_at: shareTokenExpiry(shoppingList)?.toISOString() ?? null,
    };
  }

  @Get(':token/pdf')
  async downloadPdf(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const shoppingList =
      await this.shoppingListsService.findByShareToken(token);
    const project = shoppingList.project;

    const buffer = await this.exportService.generatePdf(
      project,
      shoppingList.items_json,
    );

    const safeName =
      project.name.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim() || 'liste';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="liste-courses-${safeName}.pdf"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }
}
