import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthGuard } from './firebase-auth.guard';

interface MockRequest {
  headers: { authorization?: string };
  firebaseUser?: unknown;
}

function createMockContext(request: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  const verifyIdToken = jest.fn();
  const firebase = { getAuth: () => ({ verifyIdToken }) };

  let guard: FirebaseAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    verifyIdToken.mockResolvedValue({ uid: 'fb-1' });
    guard = new FirebaseAuthGuard(firebase as never);
  });

  it('refuse une requête sans en-tête Bearer', async () => {
    await expect(
      guard.canActivate(createMockContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('refuse un en-tête Bearer dont le jeton est vide', async () => {
    await expect(
      guard.canActivate(
        createMockContext({ headers: { authorization: 'Bearer    ' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('refuse un jeton invalide ou expiré', async () => {
    verifyIdToken.mockRejectedValue(new Error('expired'));

    await expect(
      guard.canActivate(
        createMockContext({ headers: { authorization: 'Bearer abc' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('laisse passer un jeton valide et pose l’utilisateur Firebase', async () => {
    const request: MockRequest = { headers: { authorization: 'Bearer abc' } };

    await expect(guard.canActivate(createMockContext(request))).resolves.toBe(
      true,
    );
    expect(verifyIdToken).toHaveBeenCalledWith('abc');
    expect(request.firebaseUser).toEqual({ uid: 'fb-1' });
  });
});
