import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Reject any image path that could escape the shared uploads volume.
 * Defense in depth: the CV service also validates and resolves paths,
 * but we fail fast here to avoid calling the downstream service at all
 * with attacker-controlled traversal sequences.
 */
function assertSafeUploadPath(imagePath: string): void {
  if (typeof imagePath !== 'string' || imagePath.length === 0) {
    throw new BadRequestException('image path must be a non-empty string');
  }
  if (imagePath.includes('\0')) {
    throw new BadRequestException('image path contains a null byte');
  }
  if (imagePath.includes('\\')) {
    throw new BadRequestException('image path must not contain backslashes');
  }
  if (imagePath.startsWith('/')) {
    throw new BadRequestException('image path must be relative');
  }
  // Windows-style drive letter (e.g. C:\ or C:/)
  if (/^[a-zA-Z]:[\\/]/.test(imagePath)) {
    throw new BadRequestException('image path must be relative');
  }
  const segments = imagePath.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw new BadRequestException("image path must not contain '..' segments");
  }
}

export interface CvAnalysisRequest {
  image_paths: string[];
  reference_object?: {
    type: string;
    height_cm: number;
  } | null;
}

export interface CvDetectedOpening {
  type: 'door' | 'window';
  width_cm: number;
  height_cm: number;
  confidence: number;
  count: number;
}

export interface CvAnalysisResponse {
  status: 'success' | 'no_reference' | 'error';
  dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  } | null;
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number;
  reference_detected: boolean;
  reference_type: string | null;
  openings: CvDetectedOpening[];
  num_images_processed: number;
  raw_output: Record<string, unknown>;
  error?: string;
}

@Injectable()
export class CvClientService {
  private readonly logger = new Logger(CvClientService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'cvService.url',
      'http://localhost:8000',
    );
    this.timeoutMs = this.configService.get<number>(
      'cvService.timeoutMs',
      60000,
    );
  }

  async analyze(request: CvAnalysisRequest): Promise<CvAnalysisResponse> {
    if (
      !Array.isArray(request.image_paths) ||
      request.image_paths.length === 0
    ) {
      throw new BadRequestException('image_paths must not be empty');
    }
    request.image_paths.forEach(assertSafeUploadPath);

    this.logger.log(
      `Calling CV service at ${this.baseUrl}/analyze with ${request.image_paths.length} image(s)`,
    );

    const response = await firstValueFrom(
      this.httpService.post<CvAnalysisResponse>(
        `${this.baseUrl}/analyze`,
        request,
        { timeout: this.timeoutMs },
      ),
    );

    return response.data;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/health`, { timeout: 5000 }),
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
