import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { SSO_EXEMPT_KEY } from '../decorators/sso-exempt.decorator';

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

describe('FirebaseAuthGuard — point d’application de l’enforcement SSO (PLAT-6 D8)', () => {
  const verifyIdToken = jest.fn();
  const firebase = { getAuth: () => ({ verifyIdToken }) };
  const ssoSession = { assertSessionAllowed: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn() };

  let guard: FirebaseAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    verifyIdToken.mockResolvedValue({ uid: 'fb-1' });
    reflector.getAllAndOverride.mockReturnValue(undefined);
    guard = new FirebaseAuthGuard(
      firebase as never,
      ssoSession as never,
      reflector as unknown as Reflector,
    );
  });

  it('refuse une requête sans en-tête Bearer', async () => {
    await expect(
      guard.canActivate(createMockContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ssoSession.assertSessionAllowed).not.toHaveBeenCalled();
  });

  it('refuse un jeton invalide sans consulter la politique SSO', async () => {
    verifyIdToken.mockRejectedValue(new Error('expired'));

    await expect(
      guard.canActivate(
        createMockContext({ headers: { authorization: 'Bearer abc' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ssoSession.assertSessionAllowed).not.toHaveBeenCalled();
  });

  it('vérifie la politique SSO sur une route ordinaire', async () => {
    const request: MockRequest = { headers: { authorization: 'Bearer abc' } };

    await expect(guard.canActivate(createMockContext(request))).resolves.toBe(
      true,
    );
    expect(request.firebaseUser).toEqual({ uid: 'fb-1' });
    expect(ssoSession.assertSessionAllowed).toHaveBeenCalledWith({
      uid: 'fb-1',
    });
  });

  it('saute la vérification sur une route dispensée (D10)', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await guard.canActivate(
      createMockContext({ headers: { authorization: 'Bearer abc' } }),
    );

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      SSO_EXEMPT_KEY,
      expect.any(Array),
    );
    expect(ssoSession.assertSessionAllowed).not.toHaveBeenCalled();
  });

  it('laisse remonter le refus d’enforcement', async () => {
    ssoSession.assertSessionAllowed.mockRejectedValue(
      new Error('SSO_REQUIRED'),
    );

    await expect(
      guard.canActivate(
        createMockContext({ headers: { authorization: 'Bearer abc' } }),
      ),
    ).rejects.toThrow('SSO_REQUIRED');
  });
});
