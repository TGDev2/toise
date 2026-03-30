import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface CvAnalysisRequest {
  image_paths: string[];
  reference_object?: {
    type: string;
    height_cm: number;
  } | null;
}

export interface CvAnalysisResponse {
  status: 'success' | 'no_reference' | 'error';
  dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  } | null;
  confidence: 'high' | 'medium' | 'low';
  reference_detected: boolean;
  reference_type: string | null;
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
