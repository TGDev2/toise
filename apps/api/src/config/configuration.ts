export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:3000',
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
    timeoutMs: parseInt(process.env.CV_SERVICE_TIMEOUT_MS ?? '60000', 10),
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    proPriceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 'local',
    localPath: process.env.STORAGE_LOCAL_PATH ?? './uploads',
    maxFileSizeMb: 20,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/heif',
    ],
    thumbnailWidth: 400,
  },
});
