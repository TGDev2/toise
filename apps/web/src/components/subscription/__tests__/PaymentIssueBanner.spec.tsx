import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { PaymentIssueBanner } from '../PaymentIssueBanner';

const mockSubscription: {
  subscription: {
    status: string;
    past_due_grace_ends_at: string | null;
  } | null;
  openPortal: jest.Mock;
} = {
  subscription: null,
  openPortal: jest.fn(),
};

const mockAuth = { syncWithBackend: jest.fn() };

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscription,
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const DAY_MS = 24 * 60 * 60 * 1000;

describe('PaymentIssueBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscription.subscription = null;
  });

  it('ne rend rien sans abonnement', () => {
    const { container } = render(<PaymentIssueBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['active', 'trialing', 'canceled'])(
    'ne rend rien pour un abonnement %s',
    (status) => {
      mockSubscription.subscription = {
        status,
        past_due_grace_ends_at: null,
      };

      const { container } = render(<PaymentIssueBanner />);

      // Le bandeau est monté sur tout l'espace authentifié : il doit être
      // strictement silencieux hors incident de paiement.
      expect(container).toBeEmptyDOMElement();
    },
  );

  describe('pendant le délai de grâce', () => {
    beforeEach(() => {
      mockSubscription.subscription = {
        status: 'past_due',
        past_due_grace_ends_at: new Date(Date.now() + 10 * DAY_MS).toISOString(),
      };
    });

    it("annonce que l'accès reste complet, avec l'échéance", () => {
      render(<PaymentIssueBanner />);

      expect(
        screen.getByText(/votre dernier paiement n'a pas abouti/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/votre accès reste complet/i)).toBeInTheDocument();
    });

    it('renvoie vers le portail de facturation', async () => {
      render(<PaymentIssueBanner />);

      screen.getByRole('button', { name: /mettre à jour mon paiement/i }).click();

      expect(mockSubscription.openPortal).toHaveBeenCalled();
    });

    it('ne resynchronise pas le palier tant que le délai court', () => {
      render(<PaymentIssueBanner />);

      // Rien n'a changé côté serveur : la resynchronisation ne sert qu'à
      // rattraper un déclassement déjà appliqué.
      expect(mockAuth.syncWithBackend).not.toHaveBeenCalled();
    });
  });

  describe('après expiration', () => {
    beforeEach(() => {
      mockSubscription.subscription = {
        status: 'past_due',
        past_due_grace_ends_at: new Date(Date.now() - 1 * DAY_MS).toISOString(),
      };
    });

    it('dit ce qui est perdu', () => {
      render(<PaymentIssueBanner />);

      expect(
        screen.getByText(/votre abonnement est suspendu/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/ne pouvez plus créer de devis ni de factures/i),
      ).toBeInTheDocument();
    });

    it('dit surtout ce qui est conservé', () => {
      render(<PaymentIssueBanner />);

      // Exigence dure de E5-2 : les documents déjà émis restent accessibles.
      // Ce message n'est vrai que parce que les routes de lecture de /quotes et
      // /invoices ne sont plus derrière une feature gate — les deux moitiés du
      // correctif ne peuvent pas être livrées séparément.
      expect(
        screen.getByText(
          /devis et factures déjà émis restent consultables et téléchargeables/i,
        ),
      ).toBeInTheDocument();
    });

    it('resynchronise le palier en mémoire, une seule fois', () => {
      const { rerender } = render(<PaymentIssueBanner />);
      rerender(<PaymentIssueBanner />);

      // `AuthContext` ne rafraîchit `appUser` qu'au changement d'état d'auth :
      // sans cela, l'interface continue de proposer des actions déjà refusées
      // par l'API. Une seule fois, sinon chaque rendu déclencherait un appel.
      expect(mockAuth.syncWithBackend).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * Le tableau de bord ne doit pas tenir un second discours sur l'impayé.
 *
 * Sa carte d'abonnement ne connaissait que `past_due` « tout court », sans
 * échéance. Une fois cette branche retirée au profit du bandeau, un impayé
 * retombait dans le cas par défaut — « Plan gratuit / Passer à Pro » — dont le
 * bouton ouvre un checkout que l'API refuse désormais pour un abonnement en
 * impayé. La sortie passe par le portail, jamais par une nouvelle souscription.
 *
 * Assertion sur la source plutôt que par rendu : monter la page entière
 * demanderait de simuler une douzaine de dépendances pour vérifier une garde
 * d'affichage d'une ligne.
 */
describe('Carte d’abonnement du tableau de bord', () => {
  it('est masquée pendant un impayé', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', '..', 'app', '(app)', 'dashboard', 'page.tsx'),
      'utf8',
    );

    expect(source).toContain("subscription?.status !== 'past_due'");
    // Et la branche retirée ne doit pas revenir : deux messages concurrents sur
    // le même incident, dont un qui ignore l'échéance, valent moins qu'un seul.
    expect(source).not.toContain("if (status === 'past_due')");
  });
});
