import {
  buildCommunityProjectMetadata,
  buildCommunityProjectJsonLd,
  workTypeLabel,
} from '../community-seo';
import type { CommunityProjectDetail } from '../community-types';

const baseProject: CommunityProjectDetail = {
  id: '323e4567-e89b-12d3-a456-426614174000',
  title: 'Carrelage salle de bain',
  work_type: 'tiling',
  description: 'Rénovation complète.',
  purchase_list: { material_items: [], complementary_items: [] },
  budget_summary: {
    total_real_cost: 850,
    total_brute_cost: 900,
    savings_amount: 50,
    savings_percent: 5.6,
    items_priced: 4,
    items_total: 4,
    is_complete: true,
    by_category: [],
    computed_at: '2026-07-01T00:00:00.000Z',
  },
  total_cost_cents: 85000,
  duration_days: 4,
  length_cm: 400,
  width_cm: 200,
  height_cm: 250,
  before_photo_ids: ['photo-before'],
  after_photo_ids: ['photo-after'],
  likes_count: 3,
  comments_count: 1,
  user_display_name: 'g***',
  published_at: '2026-07-01T00:00:00.000Z',
  has_liked: false,
  is_owner: false,
};

describe('workTypeLabel', () => {
  it('resolves a known work type to its French label', () => {
    expect(workTypeLabel('tiling')).toBe('Carrelage');
  });

  it('falls back to the raw value for an unknown work type', () => {
    expect(workTypeLabel('mystery')).toBe('mystery');
  });
});

describe('buildCommunityProjectMetadata', () => {
  it('builds a title with the work type, surface, and real cost', () => {
    const { title } = buildCommunityProjectMetadata(baseProject);
    expect(title).toContain('Carrelage');
    expect(title).toContain('8.0 m²');
    expect(title).toContain('850');
  });

  // Le layout racine applique déjà un title template (`%s | Chiffréo`) : un
  // titre qui le répète produirait « ... | Chiffréo | Chiffréo » dans l'onglet.
  it('does not duplicate the site name — the root layout template adds it', () => {
    const { title } = buildCommunityProjectMetadata(baseProject);
    expect(title).not.toContain('Chiffréo');
  });

  // E2-3 — l'écart est présenté comme une comparaison constatée sur les achats
  // réels du projet, jamais comme une économie que le produit ferait réaliser :
  // c'est la seule promesse chiffrée que Chiffréo publiait en SEO.
  it('mentions the real cost and the measured gap in the description', () => {
    const { description } = buildCommunityProjectMetadata(baseProject);
    expect(description).toContain('carrelage');
    expect(description).toContain('8.0 m²');
    expect(description).toContain('850');
    expect(description).toContain('6 %');
    expect(description).toContain("d'écart avec un achat pièce par pièce");
    expect(description).not.toContain('économies');
  });

  it('omits the gap mention when there is no budget summary', () => {
    const { description } = buildCommunityProjectMetadata({
      ...baseProject,
      budget_summary: null,
    });
    expect(description).not.toContain("d'écart avec un achat pièce par pièce");
  });

  it('omits the gap mention when savings_percent is 0', () => {
    const { description } = buildCommunityProjectMetadata({
      ...baseProject,
      budget_summary: {
        total_real_cost: 850,
        total_brute_cost: 850,
        savings_amount: 0,
        savings_percent: 0,
        items_priced: 4,
        items_total: 4,
        is_complete: true,
        by_category: [],
        computed_at: '2026-07-01T00:00:00.000Z',
      },
    });
    expect(description).not.toContain("d'écart avec un achat pièce par pièce");
  });

  it('builds the OG image URL from the first after photo', () => {
    const { ogImageUrl } = buildCommunityProjectMetadata(baseProject);
    expect(ogImageUrl).toContain(baseProject.id);
    expect(ogImageUrl).toContain('photo-after');
    expect(ogImageUrl).toContain('/file');
  });

  it('falls back to the first before photo when there is no after photo', () => {
    const { ogImageUrl } = buildCommunityProjectMetadata({
      ...baseProject,
      after_photo_ids: [],
    });
    expect(ogImageUrl).toContain('photo-before');
  });

  it('returns a null OG image when there are no photos at all', () => {
    const { ogImageUrl } = buildCommunityProjectMetadata({
      ...baseProject,
      before_photo_ids: [],
      after_photo_ids: [],
    });
    expect(ogImageUrl).toBeNull();
  });
});

describe('buildCommunityProjectJsonLd', () => {
  it('builds an Article schema carrying cost/surface as additionalProperty', () => {
    const jsonLd = buildCommunityProjectJsonLd(
      baseProject,
      'https://chiffreo.fr/community/323e4567-e89b-12d3-a456-426614174000',
    );
    expect(jsonLd['@type']).toBe('Article');
    expect(jsonLd.headline).toBe(baseProject.title);
    expect(jsonLd.image).toContain('photo-after');
    expect(jsonLd.datePublished).toBe(baseProject.published_at);
    expect(jsonLd.author).toEqual({ '@type': 'Person', name: 'g***' });

    const props = jsonLd.additionalProperty as Array<{
      name: string;
      value: string;
    }>;
    expect(props.find((p) => p.name === 'Coût réel')?.value).toContain('850');
    expect(props.find((p) => p.name === 'Surface')?.value).toBe('8.0 m²');
  });

  it('omits datePublished when the project has not been published yet', () => {
    const jsonLd = buildCommunityProjectJsonLd(
      { ...baseProject, published_at: null },
      'https://chiffreo.fr/community/323e4567-e89b-12d3-a456-426614174000',
    );
    expect(jsonLd.datePublished).toBeUndefined();
  });
});
