import { UnauthorizedException } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import type { AnalysisService } from './analysis.service';
import type { UsersService } from './../users/users.service';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let analysisService: { startAnalysis: jest.Mock; getJobStatus: jest.Mock };
  let usersService: { findByFirebaseUid: jest.Mock };

  const firebaseUser = { uid: 'fb-uid' } as DecodedIdToken;

  beforeEach(() => {
    analysisService = {
      startAnalysis: jest
        .fn()
        .mockResolvedValue({ id: 'job-1', status: 'pending' }),
      getJobStatus: jest.fn(),
    };
    usersService = {
      findByFirebaseUid: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    controller = new AnalysisController(
      analysisService as unknown as AnalysisService,
      usersService as unknown as UsersService,
    );
  });

  it('forwards the reference_object marker to the service', async () => {
    const res = await controller.startAnalysis('proj-1', firebaseUser, {
      reference_object: { type: 'a4' },
    });

    expect(analysisService.startAnalysis).toHaveBeenCalledWith(
      'proj-1',
      'user-1',
      { type: 'a4' },
    );
    expect(res).toEqual({ job_id: 'job-1', status: 'pending' });
  });

  it('defaults to door auto-detection when no reference is provided', async () => {
    await controller.startAnalysis('proj-1', firebaseUser, {});

    expect(analysisService.startAnalysis).toHaveBeenCalledWith(
      'proj-1',
      'user-1',
      undefined,
    );
  });

  it('rejects an unknown Firebase user', async () => {
    usersService.findByFirebaseUid.mockResolvedValue(null);

    await expect(
      controller.startAnalysis('proj-1', firebaseUser, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(analysisService.startAnalysis).not.toHaveBeenCalled();
  });
});
