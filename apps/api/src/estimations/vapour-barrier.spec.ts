import {
  resolveSubfloorType,
  resolveVapourBarrier,
  subfloorRequiresVapourBarrier,
  SUBFLOOR_TYPES,
  UnknownSubfloorTypeError,
} from './vapour-barrier';

/**
 * E1-8 — la présence du film pare-vapeur, et sa raison.
 *
 * Deux informations la décident, et elles ne vivent pas au même endroit : la
 * nature du support est une réponse de l'utilisateur, la présence d'un
 * pare-vapeur intégré est une propriété du produit. Ce spec éprouve les quatre
 * combinaisons, et surtout **ce qui est dit à l'utilisateur** dans chacune :
 * une ligne qui disparaît sans explication est indiscernable d'un oubli.
 */

const FILM = {
  id: 'flooring:Film pare-vapeur PE',
  name: 'Film pare-vapeur PE',
  vapour_barrier: 'dedicated' as const,
};
const MOUSSE = {
  id: 'flooring:Sous-couche mousse 3mm',
  name: 'Sous-couche mousse 3mm',
  vapour_barrier: null,
};
const MOUSSE_PV = {
  id: 'flooring:Sous-couche 2mm avec pare-vapeur intégré',
  name: 'Sous-couche 2mm avec pare-vapeur intégré',
  vapour_barrier: 'integrated' as const,
};
const STRATIFIE = {
  id: 'flooring:Stratifié 8mm AC4',
  name: 'Stratifié 8mm AC4',
};

const names = (materials: { name: string }[]) => materials.map((m) => m.name);

describe('resolveSubfloorType', () => {
  it('retient le premier support offert quand la question n’est pas répondue', () => {
    // Et ce premier support est celui qui **exige** le film : sans réponse, on
    // penche du côté sûr, pas du côté économe.
    expect(resolveSubfloorType({})).toBe('concrete_screed');
    expect(resolveSubfloorType(undefined)).toBe('concrete_screed');
    expect(subfloorRequiresVapourBarrier({})).toBe(true);
  });

  it('accepte chacun des supports offerts', () => {
    for (const type of SUBFLOOR_TYPES) {
      expect(resolveSubfloorType({ subfloor_type: type })).toBe(type);
    }
  });

  /**
   * Une valeur inconnue lève au lieu d'être ramenée au défaut : chiffrer « de
   * la terre battue comme du béton » rendrait un prix pour un autre chantier que
   * celui qu'on a décrit. `BadRequestException`, donc 400 et non 500 — la
   * demande est mal formée, notre catalogue n'est pas troué.
   */
  it('refuse un support inconnu, en 400', () => {
    expect(() =>
      resolveSubfloorType({ subfloor_type: 'terre battue' }),
    ).toThrow(UnknownSubfloorTypeError);
    expect(() =>
      resolveSubfloorType({ subfloor_type: 'terre battue' }),
    ).toThrow(/concrete_screed, wood_floor, existing_covering/);
  });
});

describe('resolveVapourBarrier', () => {
  describe('quand aucun film dédié n’est lié', () => {
    /**
     * Le cas des six autres ouvrages. Rien ne doit bouger, et rien ne bouge —
     * sans qu'aucune condition sur le code d'ouvrage n'ait été écrite.
     */
    it('laisse la liste intacte et ne dit rien', () => {
      const decision = resolveVapourBarrier([STRATIFIE, MOUSSE], {
        subfloor_type: 'wood_floor',
      });

      expect(decision.kept).toEqual([STRATIFIE, MOUSSE]);
      expect(decision.excluded).toEqual([]);
      expect(decision.inclusionReasonByMaterialId.size).toBe(0);
    });
  });

  describe('sur béton ou chape, sans pare-vapeur intégré', () => {
    const decision = resolveVapourBarrier([STRATIFIE, MOUSSE, FILM], {
      subfloor_type: 'concrete_screed',
    });

    it('garde le film', () => {
      expect(names(decision.kept)).toContain('Film pare-vapeur PE');
      expect(decision.excluded).toEqual([]);
    });

    it('dit pourquoi il est là, en nommant les deux conditions', () => {
      const reason = decision.inclusionReasonByMaterialId.get(FILM.id);

      expect(reason).toMatch(/béton ou chape/);
      expect(reason).toMatch(/sans pare-vapeur intégré/);
      expect(reason).toMatch(/NF DTU 51\.11/);
    });
  });

  describe('sur plancher bois', () => {
    const decision = resolveVapourBarrier([STRATIFIE, MOUSSE, FILM], {
      subfloor_type: 'wood_floor',
    });

    it('écarte le film et ne touche à rien d’autre', () => {
      expect(names(decision.kept)).toEqual([
        'Stratifié 8mm AC4',
        'Sous-couche mousse 3mm',
      ]);
      expect(names(decision.excluded.map((e) => e.material))).toEqual([
        'Film pare-vapeur PE',
      ]);
    });

    it('dit pourquoi il n’est pas là', () => {
      expect(decision.excluded[0].reason).toBe('subfloor_does_not_require');
      expect(decision.excluded[0].reason_fr).toMatch(
        /Support plancher bois : aucun pare-vapeur nécessaire/,
      );
    });

    it('ne prétend pas justifier une inclusion qui n’a pas eu lieu', () => {
      expect(decision.inclusionReasonByMaterialId.size).toBe(0);
    });
  });

  it('écarte le film sur un ancien revêtement', () => {
    const decision = resolveVapourBarrier([MOUSSE, FILM], {
      subfloor_type: 'existing_covering',
    });

    expect(decision.excluded[0].reason_fr).toMatch(/ancien revêtement/);
  });

  describe('quand une sous-couche intègre déjà un pare-vapeur', () => {
    const decision = resolveVapourBarrier([STRATIFIE, MOUSSE_PV, FILM], {
      subfloor_type: 'concrete_screed',
    });

    /**
     * Le support **exige** bien un pare-vapeur ici : c'est la sous-couche qui le
     * fournit. Poser les deux enfermerait l'humidité entre deux films, ce qui
     * est pire que n'en poser aucun.
     */
    it('écarte le film nu, sur béton pourtant', () => {
      expect(names(decision.kept)).toEqual([
        'Stratifié 8mm AC4',
        'Sous-couche 2mm avec pare-vapeur intégré',
      ]);
    });

    it('nomme la sous-couche, et non le support', () => {
      expect(decision.excluded[0].reason).toBe('underlay_integrates');
      expect(decision.excluded[0].reason_fr).toMatch(
        /« Sous-couche 2mm avec pare-vapeur intégré » intègre déjà/,
      );
      expect(decision.excluded[0].reason_fr).not.toMatch(/béton/);
    });
  });

  /**
   * L'ordre des deux motifs compte : sur plancher bois **avec** une sous-couche
   * à pare-vapeur intégré, c'est le support qu'il faut nommer — la sous-couche
   * n'est pas la raison, elle n'aurait rien changé.
   */
  it('nomme le support quand les deux motifs s’appliquent', () => {
    const decision = resolveVapourBarrier([MOUSSE_PV, FILM], {
      subfloor_type: 'wood_floor',
    });

    expect(decision.excluded[0].reason).toBe('subfloor_does_not_require');
  });
});
