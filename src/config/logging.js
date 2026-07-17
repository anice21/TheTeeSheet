// Logging configuration for the golf leaderboard application
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

export const loggingConfig = {
  // Enable/disable logging globally
  enabled: true,

  // Minimum log level to record (DEBUG, INFO, WARN, ERROR, FATAL)
  minLevel: isDev ? 'DEBUG' : 'INFO',

  // Application version for log context
  appVersion: '1.0.0',

  // Transport configuration
  transports: {
    console: isDev, // Console output in development
    firebase: isProd, // Firebase storage in production
    local: true, // IndexedDB for offline storage
  },

  // Sampling rates for production (1.0 = 100%, 0.1 = 10%)
  sampling: {
    DEBUG: isDev ? 1.0 : 0.1,
    INFO: 1.0,
    WARN: 1.0,
    ERROR: 1.0,
    FATAL: 1.0,
  },

  // Batch processing settings
  batchSize: 10, // Number of logs to batch before sending
  batchInterval: 5000, // Max time (ms) to wait before sending batch
  maxQueueSize: 100, // Max logs to queue before dropping old ones

  // Performance monitoring
  performance: {
    enabled: true,
    slowThreshold: 1000, // Log operations slower than 1s
    sampleRate: isDev ? 1.0 : 0.2, // 100% dev, 20% prod
  },

  // Firebase collection structure
  firebaseCollections: {
    errors: 'logs/app/errors',
    performance: 'logs/app/performance',
    audit: 'logs/app/audit',
    analytics: 'logs/app/analytics',
  },

  // IndexedDB configuration
  indexedDB: {
    dbName: 'golf-leaderboard-logs',
    storeName: 'logs',
    maxEntries: 1000,
  },

  // Sensitive data patterns to redact
  redactPatterns: [
    /password/i,
    /token/i,
    /apiKey/i,
    /secret/i,
    /authorization/i,
  ],

  // Rate limiting to prevent log spam
  rateLimit: {
    maxLogsPerMinute: 100,
    maxLogsPerSecond: 10,
  },
};

export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

export const LOG_CATEGORIES = {
  AUTH: 'authentication',
  TRIP: 'trip_management',
  ROUND: 'round_management',
  SCORE: 'scoring',
  FIREBASE: 'firebase',
  PERFORMANCE: 'performance',
  UI: 'user_interface',
  NAVIGATION: 'navigation',
};
