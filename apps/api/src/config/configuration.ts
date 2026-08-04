/**
 * `trust proxy` d'Express, d'où `req.ip` — donc le compteur du rate limiting.
 * Sans lui, derrière un reverse proxy, `req.ip` est l'IP du proxy et **tout le
 * trafic partage un seul compteur**. Avec lui alors qu'il n'y a pas de proxy,
 * n'importe qui choisit son compteur via `X-Forwarded-For`. Aucun défaut n'est
 * bon dans les deux cas : le défaut est donc « pas de proxy » (le plus sûr),
 * et le déploiement qui en a un le déclare (`TRUST_PROXY=1` dans
 * `docker-compose.prod.yml`).
 */
function parseTrustProxy(raw: string | undefined): boolean | number | string {
  if (raw === undefined || raw === '' || raw === 'false') return false;
  if (raw === 'true') return true;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return raw; // 'loopback', 'uniquelocal', une liste de CIDR…
}

export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'chiffreo',
    password: process.env.DB_PASSWORD ?? 'chiffreo_dev',
    name: process.env.DB_NAME ?? 'chiffreo',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  cvService: {
    url: process.env.CV_SERVICE_URL ?? 'http://localhost:8000',
    // Secret partagé avec le service d'inférence. Sa protection était jusqu'ici
    // l'isolement réseau seul — une hypothèse qu'aucune ligne n'énonçait et
    // qu'un `ports:` ajouté pour un débogage suffisait à annuler.
    token: process.env.CV_SERVICE_TOKEN ?? '',
    // L'inférence CPU sur 3-5 photos peut dépasser 60 s : défaut à 120 s.
    timeoutMs: parseInt(process.env.CV_SERVICE_TIMEOUT_MS ?? '120000', 10),
    // Débranché de la production par défaut (ADR 0001 D2) : le service n'est
    // plus dans docker-compose.prod.yml. Coupe-circuit indépendant de la gate
    // DB `cv_analysis`, pour que le pipeline reste fermé même si la gate est
    // un jour réactivée par erreur.
    enabled: process.env.CV_ENABLED === 'true',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    proPriceId: process.env.STRIPE_PRO_PRICE_ID,
    contractorEssentielPriceId:
      process.env.STRIPE_CONTRACTOR_ESSENTIEL_PRICE_ID,
    contractorStandardPriceId: process.env.STRIPE_CONTRACTOR_STANDARD_PRICE_ID,
    contractorPremiumPriceId: process.env.STRIPE_CONTRACTOR_PREMIUM_PRICE_ID,
  },
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL,
    senderName: process.env.BREVO_SENDER_NAME ?? 'Chiffréo',
  },
  priceComparison: {
    manoMano: {
      // URL du flux produits fournie par la plateforme d'affiliation (Awin,
      // Effiliation…). Elle porte le jeton du programme : jamais en dur.
      // Un chemin local ou une URL `file://` sont acceptés, ce qui permet de
      // valider le rapprochement sur un extrait de flux sans credentials.
      feedUrl: process.env.MANOMANO_FEED_URL ?? '',
      enabled: process.env.MANOMANO_ENABLED === 'true',
      timeoutMs: parseInt(process.env.MANOMANO_TIMEOUT_MS ?? '120000', 10),
      // Fraîcheur de l'index de rapprochement : au-delà, la première lecture
      // déclenche une resynchronisation en tâche de fond.
      feedTtlHours: parseInt(process.env.MANOMANO_FEED_TTL_HOURS ?? '24', 10),
    },
    leroyMerlin: {
      // BACKLOG BUY-4 : deuxième enseigne, même schéma de config que ManoMano.
      feedUrl: process.env.LEROY_MERLIN_FEED_URL ?? '',
      enabled: process.env.LEROY_MERLIN_ENABLED === 'true',
      timeoutMs: parseInt(process.env.LEROY_MERLIN_TIMEOUT_MS ?? '120000', 10),
      feedTtlHours: parseInt(
        process.env.LEROY_MERLIN_FEED_TTL_HOURS ?? '24',
        10,
      ),
    },
    cacheTtlHours: parseInt(process.env.PRICE_CACHE_TTL_HOURS ?? '24', 10),
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 'local',
    localPath: process.env.STORAGE_LOCAL_PATH ?? './uploads',
    maxFileSizeMb: 20,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/heif'],
    thumbnailWidth: 400,
    // Seuils de rejet qualite (BACKLOG CV-4) : calibres empiriquement contre sharp@0.34.5,
    // cf. tasks/todo.md (mur uni net ~0.6-3.0 de sharpness vs flou net < 0.3).
    minPhotoDimensionPx: 480,
    minPhotoBrightness: 40,
    maxPhotoBrightness: 235,
    minPhotoSharpness: 0.15,
  },
});
