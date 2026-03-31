import { SetMetadata } from '@nestjs/common';

export const FEATURE_KEY = 'feature_key';
export const RequireFeature = (featureKey: string) =>
  SetMetadata(FEATURE_KEY, featureKey);
