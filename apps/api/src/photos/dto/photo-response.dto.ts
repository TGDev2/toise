import { PhotoStatus } from '../entities/project-photo.entity';

export class PhotoResponseDto {
  id!: string;
  original_filename!: string;
  mime_type!: string;
  size_bytes!: number;
  status!: PhotoStatus;
  sort_order!: number;
  url!: string;
  thumbnail_url!: string | null;
  created_at!: Date;
}
