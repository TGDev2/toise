import { computePieceCut, PieceTooLongError } from './piece-cutting';

/**
 * E1-8 — le comptage d'un matériau découpé à longueur.
 *
 * Le cas d'école est celui du montant : une barre de 2,70 m, une hauteur sous
 * plafond de 2,50 m, une chute de 0,20 m qui ne va nulle part. Tout le module
 * tient dans la différence entre `74,520 ÷ 2,70` (ce que faisait le moteur) et
 * `ceil(30 ÷ floor(2,70 ÷ 2,30))` (ce qu'il fait).
 */

const BARRE_27 = [{ label: 'Barre 2.7 m', quantity_per_unit: 2.7, unit: 'm' }];

describe('computePieceCut', () => {
  describe('une pièce par barre — le cas de la plâtrerie', () => {
    it('achète autant de barres que d’emplacements sous 2,50 m', () => {
      const cut = computePieceCut(
        'Montant M48 2.7m',
        { count: 8, length_m: 2.5 },
        BARRE_27,
      );

      expect(cut).toEqual({
        pieces: 8,
        piece_length_m: 2.5,
        pieces_per_bar: 1,
        bars: 8,
        label: 'Barre 2.7 m',
        bar_length_m: 2.7,
      });
    });

    /**
     * Le cas qui donne son chiffre au défaut : 30 emplacements sous 2,30 m. Le
     * moteur d'avant divisait 74,520 m (69 m de trame, plus 8 % de forfait) par
     * 2,70 et achetait 28 barres — deux de moins que ce que le chantier pose.
     */
    it('achète 30 barres pour 30 emplacements sous 2,30 m', () => {
      const cut = computePieceCut(
        'Montant M48 2.7m',
        { count: 30, length_m: 2.3 },
        BARRE_27,
      );

      expect({ bars: cut.bars, parBarre: cut.pieces_per_bar }).toEqual({
        bars: 30,
        parBarre: 1,
      });
      // Ce que l'ancien calcul rendait, pour que l'écart soit lisible ici même.
      expect(Math.ceil((30 * 2.3 * 1.08) / 2.7)).toBe(28);
    });
  });

  describe('plusieurs pièces par barre', () => {
    /**
     * Rien dans la règle ne suppose une pièce par barre : c'est une conséquence
     * de la hauteur sous plafond, pas une hypothèse. Une barre de 2,70 m donne
     * trois pièces de 0,90 m — et la division, ici, tombait juste.
     */
    it('découpe trois pièces de 0,90 m dans une barre de 2,70 m', () => {
      const cut = computePieceCut(
        'Profilé',
        { count: 7, length_m: 0.9 },
        BARRE_27,
      );

      expect({ parBarre: cut.pieces_per_bar, bars: cut.bars }).toEqual({
        parBarre: 3,
        bars: 3,
      });
    });

    /**
     * `2,40 / 0,80` vaut 2.9999999999999996 en flottant — la plinthe de 2,40 m
     * débitée en trois, cas parfaitement banal. Sans tolérance, le calcul
     * rendrait deux pièces par barre et achèterait 50 % de barres en trop, un
     * défaut invisible en relecture. Même parade que `SPAN_EPSILON` et
     * `STEP_EPSILON` dans le moteur, et de même ampleur : 1e-9 pièce.
     */
    it('ne perd pas une pièce sur une division flottante inexacte', () => {
      expect(2.4 / 0.8).not.toBe(3);

      const cut = computePieceCut('Plinthe', { count: 3, length_m: 0.8 }, [
        { label: 'Barre 2.4 m', quantity_per_unit: 2.4, unit: 'm' },
      ]);

      expect({ parBarre: cut.pieces_per_bar, bars: cut.bars }).toEqual({
        parBarre: 3,
        bars: 1,
      });
    });
  });

  describe('choix du format', () => {
    /**
     * Le critère est celui du moteur (`S = q_min × contenants + volume`). Entre
     * une barre de 3 m et une de 2,70 m pour des pièces de 2,50 m, les deux ne
     * donnent qu'une pièce : la moins longue gagne, elle achète moins de
     * matière pour le même nombre de barres.
     */
    it('préfère la barre qui gaspille le moins à nombre de barres égal', () => {
      const cut = computePieceCut('Montant', { count: 4, length_m: 2.5 }, [
        { label: 'Barre 3 m', quantity_per_unit: 3, unit: 'm' },
        ...BARRE_27,
      ]);

      expect(cut.label).toBe('Barre 2.7 m');
      expect(cut.bars).toBe(4);
    });

    /** Un format trop court pour une seule pièce est écarté, pas arrondi. */
    it('ignore un format plus court qu’une pièce', () => {
      const cut = computePieceCut('Montant', { count: 4, length_m: 2.5 }, [
        { label: 'Barre 2.4 m', quantity_per_unit: 2.4, unit: 'm' },
        ...BARRE_27,
      ]);

      expect(cut.label).toBe('Barre 2.7 m');
    });
  });

  describe('ce qui doit lever', () => {
    /**
     * Aucun format assez long : le seul repli imaginable — abouter deux barres —
     * est précisément ce que le matériau déclare impossible. Chiffrer quand même
     * rendrait un prix pour une cloison qu'on ne sait pas monter.
     */
    it('refuse une pièce plus longue que la plus longue barre', () => {
      expect(() =>
        computePieceCut(
          'Montant M48 2.7m',
          { count: 4, length_m: 3 },
          BARRE_27,
        ),
      ).toThrow(PieceTooLongError);
    });

    it('nomme le matériau, la pièce et la barre dans le message', () => {
      expect(() =>
        computePieceCut(
          'Montant M48 2.7m',
          { count: 4, length_m: 3 },
          BARRE_27,
        ),
      ).toThrow(/Montant M48 2\.7m.*3\.000 m.*2\.700 m/s);
    });

    it('refuse un catalogue sans conditionnement exploitable', () => {
      expect(() =>
        computePieceCut('Montant', { count: 4, length_m: 2.5 }, []),
      ).toThrow(/aucun conditionnement exploitable/);
    });

    it('refuse une longueur de pièce inexploitable', () => {
      expect(() =>
        computePieceCut('Montant', { count: 4, length_m: 0 }, BARRE_27),
      ).toThrow(/longueur de pièce/);
    });
  });

  /** Un besoin nul n'achète rien, et ne lève pas. */
  it('n’achète aucune barre pour zéro pièce', () => {
    expect(
      computePieceCut('Montant', { count: 0, length_m: 2.5 }, BARRE_27).bars,
    ).toBe(0);
  });
});
