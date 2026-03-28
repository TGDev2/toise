import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { UserRole } from '../../users/entities/user.entity';

const mockUsersService = {
  findByFirebaseUid: jest.fn(),
};

function createMockContext(firebaseUser: unknown): ExecutionContext {
  const request = { firebaseUser } as Record<string, unknown>;
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new AdminGuard(mockUsersService as never);
  });

  it('should allow admin users', async () => {
    const adminUser = { id: 'user-uuid', role: UserRole.ADMIN };
    mockUsersService.findByFirebaseUid.mockResolvedValue(adminUser);

    const ctx = createMockContext({ uid: 'firebase-uid' });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockUsersService.findByFirebaseUid).toHaveBeenCalledWith(
      'firebase-uid',
    );
  });

  it('should reject non-admin users', async () => {
    const regularUser = { id: 'user-uuid', role: UserRole.USER };
    mockUsersService.findByFirebaseUid.mockResolvedValue(regularUser);

    const ctx = createMockContext({ uid: 'firebase-uid' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should reject when no firebase user present', async () => {
    const ctx = createMockContext(null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should reject when user not found in database', async () => {
    mockUsersService.findByFirebaseUid.mockResolvedValue(null);

    const ctx = createMockContext({ uid: 'unknown-uid' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should attach appUser to request', async () => {
    const adminUser = { id: 'user-uuid', role: UserRole.ADMIN };
    mockUsersService.findByFirebaseUid.mockResolvedValue(adminUser);

    const ctx = createMockContext({ uid: 'firebase-uid' });
    await guard.canActivate(ctx);

    const request = ctx.switchToHttp().getRequest() as Record<string, unknown>;
    expect(request.appUser).toEqual(adminUser);
  });
});
