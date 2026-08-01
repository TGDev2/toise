import { UnauthorizedException } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import type { AnalysisService } from './analysis.service';
import type { OrgContextService } from '../organizations/org-context.service';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let analysisService: { startAnalysis: jest.Mock; getJobStatus: jest.Mock };
  let orgContext: { resolveForFirebaseUid: jest.Mock };

  const firebaseUser = { uid: 'fb-uid' } as DecodedIdToken;

  beforeEach(() => {
    analysisService = {
      startAnalysis: jest
        .fn()
        .mockResolvedValue({ id: 'job-1', status: 'pending' }),
      getJobStatus: jest.fn(),
    };
    orgContext = {
      resolveForFirebaseUid: jest
        .fn()
        .mockResolvedValue({ userId: 'user-1', organizationId: 'org-1' }),
    };
    controller = new AnalysisController(
      analysisService as unknown as AnalysisService,
      orgContext as unknown as OrgContextService,
    );
  });

  it('forwards the reference_object marker to the service', async () => {
    const res = await controller.startAnalysis('proj-1', firebaseUser, {
      reference_object: { type: 'a4' },
    });

    expect(analysisService.startAnalysis).toHaveBeenCalledWith(
      'proj-1',
      'org-1',
      { type: 'a4' },
    );
    expect(res).toEqual({ job_id: 'job-1', status: 'pending' });
  });

  it('defaults to door auto-detection when no reference is provided', async () => {
    await controller.startAnalysis('proj-1', firebaseUser, {});

    expect(analysisService.startAnalysis).toHaveBeenCalledWith(
      'proj-1',
      'org-1',
      undefined,
    );
  });

  it('rejects an unknown Firebase user', async () => {
    orgContext.resolveForFirebaseUid.mockRejectedValue(
      new Error('User not found'),
    );

    await expect(
      controller.startAnalysis('proj-1', firebaseUser, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(analysisService.startAnalysis).not.toHaveBeenCalled();
  });
});
