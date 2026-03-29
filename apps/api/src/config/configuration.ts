export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
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
