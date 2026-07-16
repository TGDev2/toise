export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'estimate',
    password: process.env.DB_PASSWORD ?? 'estimate_dev',
    name: process.env.DB_NAME ?? 'estimate',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  cvService: {
    url: process.env.CV_SERVICE_URL ?? 'http://localhost:8000',
    // L'inférence CPU sur 3-5 photos peut dépasser 60 s : défaut à 120 s.
    timeoutMs: parseInt(process.env.CV_SERVICE_TIMEOUT_MS ?? '120000', 10),
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
  priceComparison: {
    homeDepot: {
      apiUrl: process.env.HOME_DEPOT_API_URL ?? '',
      apiKey: process.env.HOME_DEPOT_API_KEY ?? '',
      enabled: process.env.HOME_DEPOT_ENABLED === 'true',
    },
    lowes: {
      apiUrl: process.env.LOWES_API_URL ?? '',
      apiKey: process.env.LOWES_API_KEY ?? '',
      enabled: process.env.LOWES_ENABLED === 'true',
    },
    cacheTtlHours: parseInt(process.env.PRICE_CACHE_TTL_HOURS ?? '24', 10),
    // Mock supplier adapters are strictly opt-in: set PRICE_MOCK_ENABLED=true
    // only in dev/test. In production, no real adapter is wired yet, so the
    // `price_comparison` feature gate is disabled in the DB — enabling the
    // mock here would only serve fabricated CAD prices to paying users.
    mockEnabled: process.env.PRICE_MOCK_ENABLED === 'true',
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 'local',
    localPath: process.env.STORAGE_LOCAL_PATH ?? './uploads',
    maxFileSizeMb: 20,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/heif'],
    thumbnailWidth: 400,
  },
});
