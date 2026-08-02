import {
  buildEstimateRequestBody,
  errorMessageFor,
  init,
  validateFormValues,
  type EstimateFormValues,
} from './widget';

const API_BASE = 'http://localhost:3001';
const WIDGET_KEY = 'wgt_test123';

function makeContainer(overrides: Record<string, string | null> = {}): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-chiffreo-widget', '');
  if (overrides['data-widget-key'] !== null) {
    el.setAttribute('data-widget-key', overrides['data-widget-key'] ?? WIDGET_KEY);
  }
  if (overrides['data-api-base'] !== null) {
    el.setAttribute('data-api-base', overrides['data-api-base'] ?? API_BASE);
  }
  document.body.appendChild(el);
  return el;
}

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('validateFormValues', () => {
  const base: EstimateFormValues = {
    length_cm: 400,
    width_cm: 300,
    height_cm: 250,
    work_type_code: 'wall_painting',
    skill_level: 'intermediate',
  };

  it('accepte des dimensions dans les bornes', () => {
    expect(validateFormValues(base)).toBeNull();
  });

  it.each([
    ['length_cm', 49],
    ['length_cm', 10001],
    ['width_cm', 0],
    ['height_cm', NaN],
  ])('rejette %s hors bornes (%d)', (field, value) => {
    const values = { ...base, [field]: value };
    expect(validateFormValues(values)).not.toBeNull();
  });

  it('exige un type de travaux', () => {
    expect(validateFormValues({ ...base, work_type_code: '' })).toMatch(
      /type de travaux/i,
    );
  });
});

describe('buildEstimateRequestBody', () => {
  it('produit une seule pièce avec un seul ouvrage, sans champs superflus', () => {
    const body = buildEstimateRequestBody({
      length_cm: 400,
      width_cm: 300,
      height_cm: 250,
      work_type_code: 'wall_painting',
      skill_level: 'expert',
    });
    expect(body).toEqual({
      rooms: [
        {
          length_cm: 400,
          width_cm: 300,
          height_cm: 250,
          work_items: [{ work_type_code: 'wall_painting', skill_level: 'expert' }],
        },
      ],
    });
  });
});

describe('errorMessageFor', () => {
  it.each([
    ['ORIGIN_NOT_ALLOWED', /autorisé/],
    ['QUOTA_EXCEEDED', /quota/],
    ['RATE_LIMIT_EXCEEDED', /trop de demandes/i],
  ])('traduit %s en français', (code, expected) => {
    expect(errorMessageFor(code)).toMatch(expected);
  });

  it('retombe sur un message générique pour un code inconnu', () => {
    expect(errorMessageFor('SOMETHING_NEW')).toMatch(/erreur/i);
  });
});

describe('montage du widget', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    document.body.innerHTML = '';
    fetchMock = jest.fn((url: string) => {
      if (url.endsWith('/branding')) {
        return Promise.resolve(
          jsonResponse({ display_name: 'Bricolage Dupont', accent_color: '#0369a1', powered_by: 'Chiffréo' }),
        );
      }
      if (url.endsWith('/work-types')) {
        return Promise.resolve(
          jsonResponse([{ code: 'wall_painting', label_fr: 'Peinture murs' }]),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('monte dans une Shadow DOM isolée et affiche le formulaire', async () => {
    const container = makeContainer();
    init();
    await flushMicrotasks();

    expect(container.shadowRoot).not.toBeNull();
    const form = container.shadowRoot!.querySelector('form');
    expect(form).not.toBeNull();
    expect(container.shadowRoot!.querySelector('select')).not.toBeNull();
  });

  it('ne monte pas deux fois le même conteneur', async () => {
    const container = makeContainer();
    init();
    await flushMicrotasks();
    const callsAfterFirst = fetchMock.mock.calls.length;
    const shadowAfterFirst = container.shadowRoot;

    init();
    await flushMicrotasks();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
    expect(container.shadowRoot).toBe(shadowAfterFirst);
  });

  it("affiche un message et n'appelle pas l'API si data-api-base est absent", async () => {
    const container = makeContainer({ 'data-api-base': null });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    init();
    await flushMicrotasks();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.shadowRoot!.textContent).toMatch(/configuration manquante/i);
    consoleError.mockRestore();
  });

  it('peuple le menu des types de travaux depuis GET work-types', async () => {
    const container = makeContainer();
    init();
    await flushMicrotasks();

    const options = Array.from(
      container.shadowRoot!.querySelectorAll('select')[0].querySelectorAll('option'),
    );
    expect(options.some((o) => o.textContent === 'Peinture murs')).toBe(true);
  });

  it("n'exécute jamais un display_name malveillant : rendu en texte, jamais en HTML", async () => {
    const malicious = '<img src=x onerror="window.__xss = true">';
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/branding')) {
        return Promise.resolve(
          jsonResponse({ display_name: malicious, accent_color: '#0369a1', powered_by: 'Chiffréo' }),
        );
      }
      if (url.endsWith('/work-types')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });

    const container = makeContainer();
    init();
    await flushMicrotasks();

    expect(container.shadowRoot!.querySelector('img')).toBeNull();
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
    const brandText = Array.from(container.shadowRoot!.querySelectorAll('div')).find(
      (d) => d.textContent === malicious,
    );
    expect(brandText).toBeDefined();
  });

  it('poste une estimation avec la forme attendue et affiche le résultat', async () => {
    const container = makeContainer();
    init();
    await flushMicrotasks();

    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/estimate')) {
        return Promise.resolve(
          jsonResponse({
            aggregated: [
              {
                material_name: 'Peinture blanche',
                material_unit: 'L',
                units_needed: 3,
                packaging_label: 'pot de 2.5L',
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    const shadow = container.shadowRoot!;
    (shadow.querySelectorAll('input')[0]).value = '400';
    (shadow.querySelectorAll('input')[1]).value = '300';
    (shadow.querySelectorAll('input')[2]).value = '250';
    // Le menu contient déjà "wall_painting", peuplé par le mock GET work-types
    // du beforeEach au moment du montage.
    (shadow.querySelectorAll('select')[0]).value =
      'wall_painting';

    shadow.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await flushMicrotasks();

    const [, options] = fetchMock.mock.calls.find(([url]: [string]) =>
      url.endsWith('/estimate'),
    ) as [string, RequestInit];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({
      rooms: [
        {
          length_cm: 400,
          width_cm: 300,
          height_cm: 250,
          work_items: [{ work_type_code: 'wall_painting', skill_level: 'intermediate' }],
        },
      ],
    });
    expect(shadow.querySelector('.results')!.textContent).toContain('Peinture blanche');
  });

  it("affiche un message d'erreur français quand le quota est dépassé", async () => {
    const container = makeContainer();
    init();
    await flushMicrotasks();

    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/estimate')) {
        return Promise.resolve(
          jsonResponse({ error: 'QUOTA_EXCEEDED' }, false, 429),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    const shadow = container.shadowRoot!;
    (shadow.querySelectorAll('input')[0]).value = '400';
    (shadow.querySelectorAll('input')[1]).value = '300';
    (shadow.querySelectorAll('input')[2]).value = '250';
    // Le menu contient déjà "wall_painting", peuplé par le mock GET work-types
    // du beforeEach au moment du montage.
    (shadow.querySelectorAll('select')[0]).value =
      'wall_painting';

    shadow.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await flushMicrotasks();

    expect(shadow.querySelector('.error')!.textContent).toMatch(/quota/i);
  });
});
