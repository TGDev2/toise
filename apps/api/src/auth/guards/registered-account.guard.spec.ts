import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { RegisteredAccountGuard } from './registered-account.guard';

interface MockRequest {
  firebaseUser?: DecodedIdToken | null;
}

function createMockContext(request: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function token(signInProvider: string, email?: string): DecodedIdToken {
  return {
    uid: 'fb-1',
    email,
    firebase: { sign_in_provider: signInProvider, identities: {} },
  } as unknown as DecodedIdToken;
}

describe('RegisteredAccountGuard (E2-1)', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  let guard: RegisteredAccountGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RegisteredAccountGuard(reflector as unknown as Reflector);
  });

  describe('routes non décorées', () => {
    beforeEach(() => reflector.getAllAndOverride.mockReturnValue(undefined));

    it('laisse passer un invité : le parcours lui reste ouvert', () => {
      expect(
        guard.canActivate(
          createMockContext({ firebaseUser: token('anonymous') }),
        ),
      ).toBe(true);
    });
  });

  describe('routes décorées `@RequiresRegisteredAccount`', () => {
    beforeEach(() => reflector.getAllAndOverride.mockReturnValue(true));

    it('refuse un compte anonyme avec le code lu par le front', () => {
      let thrown: unknown;
      try {
        guard.canActivate(
          createMockContext({ firebaseUser: token('anonymous') }),
        );
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ForbiddenException);
      expect((thrown as ForbiddenException).getResponse()).toMatchObject({
        error: 'ACCOUNT_REQUIRED',
      });
    });

    it.each(['password', 'google.com', 'apple.com', 'saml.acme'])(
      'laisse passer un compte %s',
      (provider) => {
        expect(
          guard.canActivate(
            createMockContext({
              firebaseUser: token(provider, 'user@example.com'),
            }),
          ),
        ).toBe(true);
      },
    );

    /**
     * Le cas qui casserait la conversion : `linkWithCredential` ne déconnecte
     * pas l'utilisateur, donc le jeton en main peut encore annoncer
     * `anonymous` juste après l'inscription. Il porte alors l'e-mail du
     * fournisseur lié — signature d'un jeton périmé, pas d'un invité.
     */
    it("laisse passer un jeton anonyme périmé porteur d'un e-mail", () => {
      expect(
        guard.canActivate(
          createMockContext({
            firebaseUser: token('anonymous', 'converti@example.com'),
          }),
        ),
      ).toBe(true);
    });

    /**
     * Le garde se compose *après* `FirebaseAuthGuard`. Si quelqu'un inverse
     * l'ordre, l'absence de jeton doit refuser la route — jamais l'ouvrir.
     */
    it('refuse plutôt que de laisser passer si le jeton manque', () => {
      expect(() =>
        guard.canActivate(createMockContext({ firebaseUser: null })),
      ).toThrow(UnauthorizedException);
    });
  });
});
