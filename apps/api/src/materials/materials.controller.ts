import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentAppUser } from '../auth/decorators/current-app-user.decorator';
import { User } from '../users/entities/user.entity';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { QueryMaterialsDto } from './dto/query-materials.dto';
import { LinkEcoEquivalentDto } from './dto/link-eco-equivalent.dto';

@Controller('admin/materials')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  async create(@CurrentAppUser() user: User, @Body() dto: CreateMaterialDto) {
    return this.materialsService.create(dto, user.id);
  }

  @Get()
  async findAll(@Query() query: QueryMaterialsDto) {
    return this.materialsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.materialsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAppUser() user: User,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.materialsService.update(id, dto, user.id);
  }

  @Patch(':id/deactivate')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAppUser() user: User,
  ) {
    return this.materialsService.deactivate(id, user.id);
  }

  @Post(':id/eco-equivalent')
  async linkEcoEquivalent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkEcoEquivalentDto,
  ) {
    return this.materialsService.linkEcoEquivalent(id, dto.eco_material_id);
  }

  @Delete(':id/eco-equivalent/:ecoMaterialId')
  async unlinkEcoEquivalent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ecoMaterialId', ParseUUIDPipe) ecoMaterialId: string,
  ) {
    return this.materialsService.unlinkEcoEquivalent(id, ecoMaterialId);
  }
}
