/**
 * Widget d'estimation marque blanche (BACKLOG PLAT-7).
 *
 * Isolation volontaire : aucune dépendance à React ou à un framework — DOM et
 * fetch natifs seulement, pour rester minuscule et embarquable sur n'importe
 * quelle page tierce. Chaque conteneur est monté dans une Shadow DOM
 * (`attachShadow`), qui isole le CSS/JS dans les deux sens : les styles de la
 * page hôte ne peuvent pas entrer, ceux du widget ne peuvent pas sortir.
 */

const CONTAINER_SELECTOR = '[data-chiffreo-widget]';
const KEY_ATTR = 'data-widget-key';
const API_BASE_ATTR = 'data-api-base';
const BRAND_URL_ATTR = 'data-brand-url';
const MOUNTED_ATTR = 'data-chiffreo-mounted';

interface WidgetBranding {
  display_name: string | null;
  accent_color: string | null;
  powered_by: string;
}

interface WorkTypeOption {
  code: string;
  label_fr: string;
}

interface AggregatedMaterialLine {
  material_name: string;
  material_unit: string;
  units_needed: number;
  packaging_label: string;
  /**
   * E1-5 : détail par format quand l'achat panache plusieurs conditionnements.
   * Absent si un seul format suffit.
   */
  packaging_breakdown?: { label: string; units: number }[];
}

interface EstimateResponse {
  aggregated: AggregatedMaterialLine[];
}

interface ApiErrorBody {
  error?: string;
  message?: string;
}

const DEFAULT_ACCENT_COLOR = '#0369a1';

const ERROR_MESSAGES: Record<string, string> = {
  ORIGIN_REQUIRED: "Ce widget ne peut pas être appelé depuis cette page.",
  ORIGIN_NOT_ALLOWED: "Ce widget n'est pas autorisé sur ce site.",
  WIDGET_NOT_FOUND: 'Widget introuvable ou désactivé.',
  FEATURE_GATED: 'Ce widget est temporairement indisponible.',
  RATE_LIMIT_EXCEEDED: 'Trop de demandes : réessayez dans un instant.',
  QUOTA_EXCEEDED: "Ce widget a atteint son quota du mois.",
};
const DEFAULT_ERROR_MESSAGE = "Une erreur est survenue. Réessayez plus tard.";

export function errorMessageFor(errorCode: string | undefined): string {
  if (!errorCode) return DEFAULT_ERROR_MESSAGE;
  return ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE;
}

export interface EstimateFormValues {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  work_type_code: string;
  skill_level: string;
}

/** Un seul espace / un seul ouvrage en v1 — le multi-pièces reste porté par l'API, pas par ce formulaire. */
export function buildEstimateRequestBody(values: EstimateFormValues) {
  return {
    rooms: [
      {
        length_cm: values.length_cm,
        width_cm: values.width_cm,
        height_cm: values.height_cm,
        work_items: [
          {
            work_type_code: values.work_type_code,
            skill_level: values.skill_level,
          },
        ],
      },
    ],
  };
}

export function validateFormValues(
  values: EstimateFormValues,
): string | null {
  const dims: [string, number][] = [
    ['La longueur', values.length_cm],
    ['La largeur', values.width_cm],
    ['La hauteur', values.height_cm],
  ];
  for (const [label, value] of dims) {
    if (!Number.isFinite(value) || value < 50 || value > 10000) {
      return `${label} doit être comprise entre 50 et 10000 cm.`;
    }
  }
  if (!values.work_type_code) {
    return 'Choisissez un type de travaux.';
  }
  return null;
}

class ChiffreoWidgetElementRefs {
  root!: HTMLDivElement;
  form!: HTMLFormElement;
  lengthInput!: HTMLInputElement;
  widthInput!: HTMLInputElement;
  heightInput!: HTMLInputElement;
  workTypeSelect!: HTMLSelectElement;
  skillSelect!: HTMLSelectElement;
  submitButton!: HTMLButtonElement;
  errorBox!: HTMLDivElement;
  resultsBox!: HTMLDivElement;
  brandNameEl!: HTMLDivElement;
  footer!: HTMLDivElement;
}

function buildShadowDom(shadow: ShadowRoot, accentColor: string): ChiffreoWidgetElementRefs {
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .chiffreo-widget {
      --accent: ${accentColor};
      font-family: system-ui, sans-serif;
      color: #292524;
      background: #ffffff;
      border: 1px solid #e7e2da;
      border-radius: 12px;
      padding: 16px;
      max-width: 420px;
      box-sizing: border-box;
    }
    .chiffreo-widget * { box-sizing: border-box; }
    .chiffreo-widget h2 { font-size: 16px; margin: 0 0 12px; color: var(--accent); }
    .chiffreo-widget label { display: block; font-size: 13px; margin: 8px 0 4px; }
    .chiffreo-widget input, .chiffreo-widget select {
      width: 100%; padding: 6px 8px; border: 1px solid #d6d3d1; border-radius: 6px; font-size: 14px;
    }
    .chiffreo-widget button {
      margin-top: 12px; width: 100%; padding: 8px; border: none; border-radius: 6px;
      background: var(--accent); color: #fff; font-size: 14px; cursor: pointer;
    }
    .chiffreo-widget .error { color: #b91c1c; font-size: 13px; margin-top: 8px; }
    .chiffreo-widget .results { margin-top: 12px; font-size: 13px; }
    .chiffreo-widget .results ul { padding-left: 18px; margin: 4px 0; }
    .chiffreo-widget .footer { margin-top: 12px; font-size: 11px; color: #a8a29e; text-align: right; }
    .chiffreo-widget .footer a { color: inherit; }
  `;

  const root = document.createElement('div');
  root.className = 'chiffreo-widget';

  const brandNameEl = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = 'Estimation de matériaux';

  const form = document.createElement('form');

  function field(labelText: string, input: HTMLInputElement | HTMLSelectElement) {
    const label = document.createElement('label');
    label.textContent = labelText;
    label.appendChild(input);
    form.appendChild(label);
  }

  const lengthInput = document.createElement('input');
  lengthInput.type = 'number';
  lengthInput.required = true;
  field('Longueur (cm)', lengthInput);

  const widthInput = document.createElement('input');
  widthInput.type = 'number';
  widthInput.required = true;
  field('Largeur (cm)', widthInput);

  const heightInput = document.createElement('input');
  heightInput.type = 'number';
  heightInput.required = true;
  field('Hauteur (cm)', heightInput);

  const workTypeSelect = document.createElement('select');
  field('Type de travaux', workTypeSelect);

  const skillSelect = document.createElement('select');
  const skillLevels: [string, string][] = [
    ['beginner', 'Débutant'],
    ['intermediate', 'Intermédiaire'],
    ['expert', 'Expert'],
  ];
  for (const [value, label] of skillLevels) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    skillSelect.appendChild(option);
  }
  skillSelect.value = 'intermediate';
  field('Niveau', skillSelect);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Estimer';
  form.appendChild(submitButton);

  const errorBox = document.createElement('div');
  errorBox.className = 'error';

  const resultsBox = document.createElement('div');
  resultsBox.className = 'results';

  const footer = document.createElement('div');
  footer.className = 'footer';

  root.appendChild(style);
  root.appendChild(brandNameEl);
  root.appendChild(heading);
  root.appendChild(form);
  root.appendChild(errorBox);
  root.appendChild(resultsBox);
  root.appendChild(footer);
  shadow.appendChild(root);

  return {
    root,
    form,
    lengthInput,
    widthInput,
    heightInput,
    workTypeSelect,
    skillSelect,
    submitButton,
    errorBox,
    resultsBox,
    brandNameEl,
    footer,
  } as ChiffreoWidgetElementRefs;
}

/** `display_name` est fourni par l'organisation, jamais par le widget lui-même : rendu en texte brut uniquement, jamais en HTML. */
function applyBranding(refs: ChiffreoWidgetElementRefs, branding: WidgetBranding) {
  refs.brandNameEl.textContent = branding.display_name ?? '';
  refs.root.style.setProperty(
    '--accent',
    branding.accent_color ?? DEFAULT_ACCENT_COLOR,
  );
}

function renderFooter(footer: HTMLDivElement, brandUrl: string | null) {
  footer.textContent = '';
  const text = document.createTextNode('Propulsé par ');
  footer.appendChild(text);
  if (brandUrl) {
    const link = document.createElement('a');
    link.href = brandUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Chiffréo';
    footer.appendChild(link);
  } else {
    footer.appendChild(document.createTextNode('Chiffréo'));
  }
}

function renderResults(resultsBox: HTMLDivElement, response: EstimateResponse) {
  resultsBox.textContent = '';
  if (response.aggregated.length === 0) return;
  const list = document.createElement('ul');
  for (const line of response.aggregated) {
    const item = document.createElement('li');
    // E1-5 : un achat panaché se détaille format par format. « 2 × Pot 5 L +
    // Pot 2.5 L » se lirait comme deux fois le couple.
    const units = line.packaging_breakdown?.length
      ? line.packaging_breakdown
      : [{ label: line.packaging_label, units: line.units_needed }];
    const purchase = units.map((u) => `${u.units} × ${u.label}`).join(' + ');
    item.textContent = `${purchase} — ${line.material_name}`;
    list.appendChild(item);
  }
  resultsBox.appendChild(list);
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function mount(container: HTMLElement): Promise<void> {
  if (container.hasAttribute(MOUNTED_ATTR)) return;
  container.setAttribute(MOUNTED_ATTR, 'true');

  const widgetKey = container.getAttribute(KEY_ATTR);
  const apiBase = container.getAttribute(API_BASE_ATTR);
  const brandUrl = container.getAttribute(BRAND_URL_ATTR);

  const shadow = container.attachShadow({ mode: 'open' });

  if (!widgetKey || !apiBase) {
    const message = document.createElement('div');
    message.textContent = `Widget Chiffréo : configuration manquante (${KEY_ATTR}/${API_BASE_ATTR}).`;
    shadow.appendChild(message);
    console.error(
      `[chiffreo-widget] attributs ${KEY_ATTR} et ${API_BASE_ATTR} requis sur`,
      container,
    );
    return;
  }

  const base = `${apiBase.replace(/\/$/, '')}/api/v1/widget/${widgetKey}`;
  const refs = buildShadowDom(shadow, DEFAULT_ACCENT_COLOR);
  renderFooter(refs.footer, brandUrl);

  try {
    const [brandingRes, workTypesRes] = await Promise.all([
      fetch(`${base}/branding`),
      fetch(`${base}/work-types`),
    ]);

    if (brandingRes.ok) {
      applyBranding(refs, (await brandingRes.json()) as WidgetBranding);
    }
    if (workTypesRes.ok) {
      const workTypes = (await workTypesRes.json()) as WorkTypeOption[];
      for (const wt of workTypes) {
        const option = document.createElement('option');
        option.value = wt.code;
        option.textContent = wt.label_fr;
        refs.workTypeSelect.appendChild(option);
      }
    }
  } catch {
    refs.errorBox.textContent = DEFAULT_ERROR_MESSAGE;
  }

  refs.form.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSubmit(base, refs);
  });
}

async function handleSubmit(
  base: string,
  refs: ChiffreoWidgetElementRefs,
): Promise<void> {
  refs.errorBox.textContent = '';
  refs.resultsBox.textContent = '';

  const values: EstimateFormValues = {
    length_cm: refs.lengthInput.valueAsNumber,
    width_cm: refs.widthInput.valueAsNumber,
    height_cm: refs.heightInput.valueAsNumber,
    work_type_code: refs.workTypeSelect.value,
    skill_level: refs.skillSelect.value,
  };

  const validationError = validateFormValues(values);
  if (validationError) {
    refs.errorBox.textContent = validationError;
    return;
  }

  refs.submitButton.disabled = true;
  try {
    const response = await fetch(`${base}/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEstimateRequestBody(values)),
    });

    if (!response.ok) {
      const body = (await parseJsonSafely(response)) as ApiErrorBody | null;
      refs.errorBox.textContent = errorMessageFor(body?.error);
      return;
    }

    renderResults(refs.resultsBox, (await response.json()) as EstimateResponse);
  } catch {
    refs.errorBox.textContent = DEFAULT_ERROR_MESSAGE;
  } finally {
    refs.submitButton.disabled = false;
  }
}

export function init(root: ParentNode = document): void {
  const containers = root.querySelectorAll<HTMLElement>(CONTAINER_SELECTOR);
  containers.forEach((container) => {
    void mount(container);
  });
}

declare global {
  interface Window {
    ChiffreoWidget?: { init: typeof init };
  }
}

function autoInit(): void {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
}

if (typeof window !== 'undefined') {
  window.ChiffreoWidget = { init };
  autoInit();
}
