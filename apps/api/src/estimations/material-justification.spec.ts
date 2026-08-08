import { buildMaterialJustification } from './material-justification';

describe('buildMaterialJustification', () => {
  it('rend une phrase fabricant, avec et sans marque', () => {
    const justification = buildMaterialJustification({
      material_unit: 'L',
      source_manufacturer: 'Dulux Valentine',
      source_product: 'Crème de Couleur Mat Velouté',
      source_url: 'https://www.duluxvalentine.com/exemple',
      source_consulted_on: '2026-08-03',
      source_basis_fr: '≈ 11 m²/L par couche, en peinture acrylique mate',
    });

    expect(justification).toBeDefined();
    expect(justification!.text_fr).toBe(
      '≈ 11 m²/L par couche, en peinture acrylique mate selon la fiche ' +
        'technique Dulux Valentine Crème de Couleur Mat Velouté consultée ' +
        'le 03/08/2026.',
    );
    expect(justification!.text_unbranded_fr).toBe(
      '≈ 11 m²/L par couche, en peinture acrylique mate selon la fiche ' +
        'technique du fabricant consultée le 03/08/2026.',
    );
    expect(justification!.text_unbranded_fr).not.toMatch(/Dulux/);
    expect(justification!.source_url).toBe(
      'https://www.duluxvalentine.com/exemple',
    );
  });

  it('rend une phrase définitionnelle identique dans les deux variantes', () => {
    const justification = buildMaterialJustification({
      material_unit: 'm2',
      source_manufacturer: null,
      source_basis_fr: 'Vendu et posé au m² : rendement définitionnel.',
    });

    expect(justification).toBeDefined();
    expect(justification!.text_fr).toBe(
      'Vendu et posé au m² : rendement définitionnel.',
    );
    expect(justification!.text_unbranded_fr).toBe(justification!.text_fr);
    expect(justification!.source_url).toBeUndefined();
  });

  it('reprend verbatim la raison d’inclusion déjà rédigée par un module de règle', () => {
    const justification = buildMaterialJustification({
      material_unit: 'm2',
      source_manufacturer: null,
      source_basis_fr: 'Vendu et posé au m² : rendement définitionnel.',
      inclusion_reason_fr:
        'Support béton ou chape et sous-couche sans pare-vapeur intégré : le film est nécessaire (NF DTU 51.11).',
    });

    expect(justification!.text_fr).toBe(
      'Vendu et posé au m² : rendement définitionnel. Support béton ou ' +
        'chape et sous-couche sans pare-vapeur intégré : le film est ' +
        'nécessaire (NF DTU 51.11).',
    );
  });

  it('rend absent quand le matériau ne porte aucune source', () => {
    expect(
      buildMaterialJustification({
        material_unit: 'L',
        source_basis_fr: null,
      }),
    ).toBeUndefined();
  });

  describe('carrelage — mortier-colle', () => {
    const CERMIX_ADHESIVE = {
      material_unit: 'kg',
      source_manufacturer: 'Cermix',
      source_product: 'CERMIFLEX (C2S1 ET)',
      source_url: 'https://www.cermix.com/exemple',
      source_consulted_on: '2026-08-07',
      // Rendement à la géométrie de référence (45x45) — ne doit PAS survivre
      // tel quel dans la phrase, remplacé par `explainAdhesiveRate`.
      source_basis_fr:
        '7 kg/m² en U9, sol intérieur, carreau 1 200-2 200 cm², double encollage — rendement exprimé à la géométrie de référence 45x45 cm du modèle',
      consumption_model: 'tile_adhesive' as const,
    };

    /**
     * Le carreau de l'énoncé (45x45 = 2 025 cm²) tombe dans la tranche
     * 1 200-2 200 cm², où la fiche Cermix publie **directement** 7 kg/m² —
     * il n'y a pas de cellule simple encollage à côté pour cette tranche, donc
     * pas de « + 1,5 kg/m² » à afficher : l'écrire mentirait sur le calcul.
     */
    it('cite le taux réellement appliqué et le seuil direct au-delà de 1 200 cm²', () => {
      const justification = buildMaterialJustification({
        ...CERMIX_ADHESIVE,
        tile_context: {
          custom_params: { tile_format: '45x45' },
          surface_target: 'floor',
        },
      });

      expect(justification!.text_fr).toBe(
        '7 kg/m² en U9, sol intérieur selon la fiche technique Cermix ' +
          'CERMIFLEX (C2S1 ET) consultée le 07/08/2026. Double encollage ' +
          'obligatoire au-delà de 1 200 cm² (NF DTU 52.2) : votre carreau ' +
          'fait 2 025 cm².',
      );
    });

    /**
     * Un 20x20 (400 cm²) tombe dans la tranche ≤ 300 cm²… non, dans la
     * tranche 300 < S ≤ 500, où la fiche publie une cellule simple (4,5) et
     * une cellule double (4,5 + 1,5 = 6) : c'est la seule tranche où
     * l'additif a un sens, et la phrase doit le dire.
     */
    it('cite le supplément additif dans la tranche où la fiche publie les deux cellules', () => {
      const justification = buildMaterialJustification({
        ...CERMIX_ADHESIVE,
        tile_context: {
          custom_params: { tile_format: '30x30' },
          surface_target: 'floor',
        },
      });

      expect(justification!.text_fr).toContain('6 kg/m² en U9');
      expect(justification!.text_fr).toContain(
        'requis pour ce carreau à faible porosité, entre 500 et 1 200 cm² ' +
          '(NF DTU 52.2) : votre carreau fait 900 cm², soit +1,5 kg/m² par ' +
          'rapport au simple encollage.',
      );
    });

    it('ne cite aucune règle quand le double encollage ne se déclenche pas (mur, petit format)', () => {
      const justification = buildMaterialJustification({
        ...CERMIX_ADHESIVE,
        tile_context: {
          custom_params: { tile_format: '20x20' },
          surface_target: 'wall',
        },
      });

      expect(justification!.text_fr).not.toMatch(/Double encollage/);
      expect(justification!.text_fr).toMatch(
        /^3,5 kg\/m² en U6, mur intérieur/,
      );
    });
  });
});
