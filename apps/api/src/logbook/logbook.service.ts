import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RoomLogEntry,
  RoomLogMaterialSnapshot,
} from './entities/room-log-entry.entity';
import { ProjectsService } from '../projects/projects.service';
import { EstimationResult } from '../estimations/entities/estimation-result.entity';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';

@Injectable()
export class LogbookService {
  constructor(
    @InjectRepository(RoomLogEntry)
    private readonly repo: Repository<RoomLogEntry>,
    private readonly projectsService: ProjectsService,
  ) {}

  async findAllByUser(userId: string): Promise<RoomLogEntry[]> {
    return this.repo.find({
      where: { user_id: userId },
      order: { recorded_at: 'DESC' },
    });
  }

  /**
   * Instantané par pièce d'un chantier terminé (PLAT-1). Appelé depuis
   * `ShoppingListsService.finalizeBudgetSummary`, avec l'estimation et la
   * liste d'achats déjà chargées par l'appelant (pas de dépendance vers
   * `ShoppingListsModule` pour éviter le cycle). Upsert sur
   * `(project_id, room_id)` : une ré-finalisation du même chantier met à
   * jour l'entrée plutôt que de la dupliquer.
   */
  async recordChantierCompletion(
    projectId: string,
    userId: string,
    estimation: EstimationResult,
    shoppingList: ShoppingList,
  ): Promise<void> {
    const project = await this.projectsService.findOneForUser(
      projectId,
      userId,
    );
    const rooms = await this.projectsService.getRooms(projectId, userId);

    const infoByMaterialId = new Map(
      shoppingList.items_json.material_items.map((item) => [
        item.material_id,
        {
          material_category: item.material_category,
          real_unit_price: item.real_unit_price ?? null,
          store_name: item.store_name ?? null,
        },
      ]),
    );

    for (const room of rooms) {
      if (!room.dimensions) continue;

      const materialsById = new Map<string, RoomLogMaterialSnapshot>();
      for (const item of estimation.items_json) {
        if (item.room_id !== room.id) continue;
        if (materialsById.has(item.material_id)) continue;

        const info = infoByMaterialId.get(item.material_id);
        materialsById.set(item.material_id, {
          material_id: item.material_id,
          material_name: item.material_name,
          material_category: info?.material_category ?? '',
          work_type_label: item.work_type_label,
          pose_type: item.pose_type,
          real_unit_price: info?.real_unit_price ?? null,
          store_name: info?.store_name ?? null,
        });
      }

      const existing = await this.repo.findOne({
        where: { project_id: projectId, room_id: room.id },
      });

      const entry =
        existing ??
        this.repo.create({ project_id: projectId, room_id: room.id });

      entry.user_id = userId;
      entry.project_name = project.name;
      entry.room_name = room.name;
      entry.dimensions_snapshot = {
        length_cm: room.dimensions.length_cm,
        width_cm: room.dimensions.width_cm,
        height_cm: room.dimensions.height_cm,
        source: room.dimensions.source,
        segments_json: room.dimensions.segments_json,
      };
      entry.materials_snapshot = Array.from(materialsById.values());
      entry.recorded_at = new Date();

      await this.repo.save(entry);
    }
  }
}
