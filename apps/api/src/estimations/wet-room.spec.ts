import {
  resolveWaterExposure,
  resolveWetRoom,
  UnknownWaterExposureError,
  WATER_EXPOSURES,
  WetRoomCandidate,
} from './wet-room';

/**
 * E1-10 — le déclenchement du SEL, éprouvé comme `vapour-barrier.spec.ts`
 * éprouve celui du film : le défaut, chaque valeur, la valeur inconnue, et la
 * traversée à l'identique de tout matériau non concerné.
 */

const sel: WetRoomCandidate = {
  id: 'sel',
  name: "SEL (Système d'Étanchéité Liquide)",
  wet_room_system: 'sel',
};
const band: WetRoomCandidate = {
  id: 'band',
  name: "Bande d'étanchéité 120mm",
  wet_room_system: 'sealing_band',
};
const tile: WetRoomCandidate = {
  id: 'tile',
  name: 'Carrelage sol 45x45 cm',
};

describe('resolveWaterExposure', () => {
  it("retient `dry` sans réponse — l'inversion assumée de la doctrine E1-8", () => {
    expect(resolveWaterExposure(undefined)).toBe('dry');
    expect(resolveWaterExposure(null)).toBe('dry');
    expect(resolveWaterExposure({})).toBe('dry');
    expect(resolveWaterExposure({ water_exposure: '' })).toBe('dry');
    // Le défaut est le premier choix de l'écran : une seule source de vérité.
    expect(WATER_EXPOSURES[0]).toBe('dry');
  });

  it('rend chaque exposition déclarée telle quelle', () => {
    expect(resolveWaterExposure({ water_exposure: 'dry' })).toBe('dry');
    expect(resolveWaterExposure({ water_exposure: 'wet_room' })).toBe(
      'wet_room',
    );
  });

  it('lève sur une exposition inconnue plutôt que de chiffrer autre chose', () => {
    expect(() => resolveWaterExposure({ water_exposure: 'piscine' })).toThrow(
      UnknownWaterExposureError,
    );
  });
});

describe('resolveWetRoom', () => {
  it('ne touche à rien quand aucun matériau ne porte de rôle d’étanchéité', () => {
    const decision = resolveWetRoom([tile], {});
    expect(decision.kept).toEqual([tile]);
    expect(decision.excluded).toEqual([]);
    expect(decision.inclusionReasonByMaterialId.size).toBe(0);
  });

  it('écarte SEL et bande en local sec, avec le motif rendu à l’écran', () => {
    const decision = resolveWetRoom([tile, sel, band], {});

    expect(decision.kept).toEqual([tile]);
    expect(decision.excluded.map((e) => e.material.id)).toEqual([
      'sel',
      'band',
    ]);
    for (const excluded of decision.excluded) {
      expect(excluded.reason).toBe('room_not_wet');
      expect(excluded.reason_fr).toContain('Local déclaré sec');
      expect(excluded.reason_fr).toContain('NF DTU 52.2');
    }
  });

  it('garde tout en salle d’eau, et motive l’inclusion des marqués', () => {
    const decision = resolveWetRoom([tile, sel, band], {
      water_exposure: 'wet_room',
    });

    expect(decision.kept).toEqual([tile, sel, band]);
    expect(decision.excluded).toEqual([]);
    expect(decision.inclusionReasonByMaterialId.get('sel')).toContain(
      "salle d'eau",
    );
    expect(decision.inclusionReasonByMaterialId.get('band')).toContain(
      'NF DTU 52.2',
    );
    expect(decision.inclusionReasonByMaterialId.has('tile')).toBe(false);
  });

  it('préserve l’ordre reçu des matériaux conservés', () => {
    const decision = resolveWetRoom([sel, tile, band], {
      water_exposure: 'dry',
    });
    expect(decision.kept).toEqual([tile]);
  });
});
