import { EstimationEngine, PackagingInput } from './estimation-engine';

/**
 * E1-9 — ce que le moteur doit **acheter**, et pourquoi.
 *
 * Ce fichier est écrit rouge : chacun de ces cas était produit tel quel par le
 * moteur d'avant ce lot, sur le catalogue réel. Il ne teste pas une
 * implémentation, il teste une décision d'achat — celle qu'un artisan prend au
 * rayon.
 *
 * Le critère d'avant minimisait `S = q_min × contenants + volume`, où `q_min`
 * est le **plus petit format offert**. Sur la peinture, `q_min = 0,5 L` : un
 * contenant de plus ne « coûte » qu'un demi-litre, donc trois pots battent un
 * seul dès qu'ils économisent 1,5 L de peinture. C'est la racine de tout ce qui
 * suit.
 */
describe('E1-9 — la fonction objectif du conditionnement', () => {
  const engine = new EstimationEngine();

  const paint = (): PackagingInput[] => [
    { label: 'Pot 0.5 L', quantity_per_unit: 0.5, unit: 'L' },
    { label: 'Pot 2.5 L', quantity_per_unit: 2.5, unit: 'L' },
    { label: 'Pot 5 L', quantity_per_unit: 5, unit: 'L' },
    { label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' },
  ];

  /** Natte de découplage du catalogue seedé : deux formats, rapport de 1 à 6. */
  const decouplingMat = (): PackagingInput[] => [
    { label: 'Rouleau 5 m²', quantity_per_unit: 5, unit: 'm2' },
    { label: 'Rouleau 30 m²', quantity_per_unit: 30, unit: 'm2' },
  ];

  const bought = (qty: number, packagings: PackagingInput[]): string =>
    engine
      .selectBestPackaging(qty, packagings)
      .breakdown.map((b) => `${b.units} × ${b.label}`)
      .join(' + ');

  describe('le nombre de contenants passe avant le surplus', () => {
    /**
     * Le cas d'origine, relevé dans les instantanés du harnais :
     * `wall_painting` au niveau expert demande 3,497 L de sous-couche
     * universelle, et le moteur achetait « 1 × Pot 2,5 L + 2 × Pot 0,5 L ».
     *
     * Trois contenants, un peu plus cher en euros — et surtout deux pots de
     * 0,5 L de sous-couche universelle, un conditionnement que le rayon
     * professionnel ne tient quasiment pas. Le pot de 5 L est la réponse du
     * métier.
     */
    it('achète un pot de 5 L pour 3,497 L de sous-couche', () => {
      expect(bought(3.497, paint())).toBe('1 × Pot 5 L');
    });

    it('ne descend jamais sous le besoin', () => {
      const result = engine.selectBestPackaging(3.497, paint());
      expect(result.units_needed * result.qty_per_unit).toBeGreaterThanOrEqual(
        3.497,
      );
    });

    /**
     * Même motif, un cran plus haut : deux pièces peintes demandent 16 L. Le
     * critère d'avant achetait `1 × 10 L + 1 × 5 L + 2 × 0,5 L` — quatre
     * contenants pour tomber pile. Deux pots de 10 L, c'est le même achat en
     * deux gestes.
     */
    it('achète deux pots de 10 L pour 16 L de peinture', () => {
      expect(bought(16, paint())).toBe('2 × Pot 10 L');
    });
  });

  describe('le surplus relatif borne le critère', () => {
    /**
     * Le défaut **symétrique** de celui qu'on corrige, et la raison d'être du
     * plafond : « moins de contenants » sans borne achète le rouleau de 30 m²
     * pour 12,6 m² de natte. Aux prix constatés, c'est ~450 € au lieu de ~270 €
     * — et 17 m² de natte de découplage à la benne.
     */
    it('refuse le rouleau de 30 m² pour 12,6 m² de natte', () => {
      expect(bought(12.6, decouplingMat())).toBe('3 × Rouleau 5 m²');
    });

    /**
     * La borne est **relative**, et c'est ce qui la rend compatible avec la
     * mutualisation : `V ≤ 2 q` pour chaque pièce entraîne `Σ V ≤ 2 Σ q`.
     */
    it('accepte le gros rouleau dès que le besoin le justifie', () => {
      expect(bought(28, decouplingMat())).toBe('1 × Rouleau 30 m²');
    });

    /**
     * Conséquence à écrire noir sur blanc, parce qu'elle surprend et qu'un
     * invariant du harnais s'appuie dessus (I5) : **le nombre de contenants
     * n'est pas monotone en quantité**. La borne s'élargit avec le besoin, donc
     * un besoin plus grand ouvre des formats qu'un besoin plus petit
     * s'interdit. Ce n'est pas un défaut, c'est la borne qui fait son travail.
     */
    it('peut acheter moins de contenants pour un besoin plus grand', () => {
      expect(bought(12.6, decouplingMat())).toBe('3 × Rouleau 5 m²');
      expect(bought(15.5, decouplingMat())).toBe('1 × Rouleau 30 m²');
    });

    /**
     * Quand **aucun** achat ne tient dans la borne — un besoin très petit
     * devant le plus petit format — le plafond s'efface : on ne peut pas ne
     * rien acheter. C'est le seul repli, et il prend le volume minimal.
     */
    it("retombe sur le volume minimal quand la borne n'est pas tenable", () => {
      const single: PackagingInput[] = [
        { label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' },
      ];
      expect(bought(6, single)).toBe('1 × Sac 25 kg');
      expect(bought(1.4, decouplingMat())).toBe('1 × Rouleau 5 m²');
    });
  });

  describe('la pénalité sur les conditionnements marginaux', () => {
    /**
     * À nombre de contenants égal, un second format n'est retenu que s'il fait
     * gagner au moins 5 % du besoin. `9 × 1,44 + 1 × 1,08 = 14,04 m²` contre
     * `10 × 1,44 = 14,40 m²` : mêmes dix cartons, 0,36 m² gagnés, soit 2,6 % du
     * besoin. Une seconde référence sur la liste ne se paie pas pour cela.
     */
    it('renonce à un second format pour un gain de 2,6 % du besoin', () => {
      const tiles: PackagingInput[] = [
        { label: 'Carton 1.08 m²', quantity_per_unit: 1.08, unit: 'm2' },
        { label: 'Carton 1.44 m²', quantity_per_unit: 1.44, unit: 'm2' },
      ];
      expect(bought(13.8, tiles)).toBe('10 × Carton 1.44 m²');
    });

    /**
     * Le pendant : quand le gain est franc, le panachage tient. 12,4 L en
     * `10 L + 2,5 L` gagne 7,5 L sur `10 L + 10 L`, soit 60 % du besoin, à
     * nombre de contenants identique.
     */
    it('garde le panachage quand il gagne 60 % du besoin', () => {
      expect(bought(12.4, paint())).toBe('1 × Pot 10 L + 1 × Pot 2.5 L');
    });

    /** La pénalité n'a jamais le droit d'ajouter un contenant. */
    it('ne fait jamais retenir un contenant de plus', () => {
      const tiles: PackagingInput[] = [
        { label: 'Carton 1.08 m²', quantity_per_unit: 1.08, unit: 'm2' },
        { label: 'Carton 1.44 m²', quantity_per_unit: 1.44, unit: 'm2' },
      ];
      for (let qty = 0.5; qty <= 40; qty += 0.5) {
        const mixed = engine.selectBestPackaging(qty, tiles);
        const singleFormat = Math.ceil(qty / 1.44 - 1e-9);
        expect(mixed.units_needed).toBeLessThanOrEqual(singleFormat);
      }
    });
  });

  describe('le prix, quand il existe, prime sur le nombre de contenants', () => {
    /**
     * Le catalogue ne porte aucun prix : ni `materials_catalog` ni
     * `material_packaging` n'ont de colonne de prix, et les prix marchands
     * vivent en aval de l'estimation, dans le cache fournisseur. Le mode coût
     * est donc **éprouvé mais non alimenté** aujourd'hui — c'est écrit ici
     * plutôt que promis ailleurs, et `PackagingInput.unit_price` est le seul
     * point d'entrée à brancher le jour où un prix remonte jusqu'au moteur.
     */
    const pricedPaint = (): PackagingInput[] => [
      { label: 'Pot 0.5 L', quantity_per_unit: 0.5, unit: 'L', unit_price: 8 },
      { label: 'Pot 2.5 L', quantity_per_unit: 2.5, unit: 'L', unit_price: 25 },
      { label: 'Pot 5 L', quantity_per_unit: 5, unit: 'L', unit_price: 40 },
      { label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L', unit_price: 70 },
    ];

    it('préfère deux contenants moins chers à un contenant plus cher', () => {
      // 6,68 L : 1 × 10 L = 70 €, contre 5 L + 2,5 L = 65 €. Sans prix, le
      // critère prend le pot unique ; avec les prix, il prend le couple.
      expect(bought(6.68, paint())).toBe('1 × Pot 10 L');
      expect(bought(6.68, pricedPaint())).toBe('1 × Pot 5 L + 1 × Pot 2.5 L');
    });

    it('départage deux achats de même prix par le nombre de contenants', () => {
      const flat: PackagingInput[] = [
        { label: 'Bidon 1 L', quantity_per_unit: 1, unit: 'L', unit_price: 10 },
        { label: 'Bidon 2 L', quantity_per_unit: 2, unit: 'L', unit_price: 20 },
      ];
      // 4 L coûtent 40 € de toutes les façons : deux bidons de 2 L l'emportent.
      expect(bought(4, flat)).toBe('2 × Bidon 2 L');
    });

    it('replie sur le nombre de contenants dès qu’un format n’a pas de prix', () => {
      const partial = pricedPaint().map((pkg) =>
        pkg.label === 'Pot 2.5 L' ? { ...pkg, unit_price: undefined } : pkg,
      );
      expect(bought(6.68, partial)).toBe('1 × Pot 10 L');
    });
  });
});
