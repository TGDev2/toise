import { IsString } from 'class-validator';

export class MergeGuestDto {
  @IsString()
  anonymous_firebase_uid!: string;
}
