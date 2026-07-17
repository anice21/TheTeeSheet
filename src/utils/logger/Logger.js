import { LOG_LEVELS, loggingConfig } from '../../config/logging';
import { SamplingFilter } from './filters/SamplingFilter';
import { RateLimitFilter } from './filters/RateLimitFilter';
import { ConsoleTransport } from './transports/ConsoleTransport';
import { LocalTransport } from './transports/LocalTransport';
import { FirebaseTransport } from './transports/FirebaseTransport';

// Core Logger class
export class Logger {
  constructor(config = {}, db = null) {
    this.config = { ...loggingConfig, ...config };
    this.transports = [];
    this.queue = [];
    this.flushTimer = null;
    this.sessionId = this.generateSessionId();
    this.context = {};
    
    // Initialize filters
    this.samplingFilter = new SamplingFilter(this.config.sampling);
    this.rateLimitFilter = new RateLimitFilter(
      this.config.rateLimit.maxLogsPerSecond,
      this.config.rateLimit.maxLogsPerMinute
    );

    // Initialize transports
    if (this.config.transports.console) {
      this.transports.push(new ConsoleTransport());
    }
    if (this.config.transports.local) {
      this.transports.push(new LocalTransport(this.config.indexedDB));
    }
    if (this.config.transports.firebase && db) {
      this.transports.push(new FirebaseTransport(db, this.config.firebaseCollections));
    }

    // Start batch processing
    this.startBatchProcessing();
  }

  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  createLogEntry(level, message, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...this.context,
        sessionId: this.sessionId,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      },
      metadata: this.redactSensitiveData(metadata),
      environment: this.config.transports.console ? 'development' : 'production',
      appVersion: this.config.appVersion,
    };

    return entry;
  }

  redactSensitiveData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const redacted = { ...data };
    
    for (const [key, value] of Object.entries(redacted)) {
      // Check if key matches sensitive patterns
      const isSensitive = this.config.redactPatterns.some(pattern => 
        pattern.test(key)
      );

      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactSensitiveData(value);
      }
    }

    return redacted;
  }

  shouldLog(level) {
    if (!this.config.enabled) {
      return false;
    }

    // Check log level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) {
      return false;
    }

    // Check sampling
    if (!this.samplingFilter.shouldLog(level)) {
      return false;
    }

    // Check rate limiting
    if (!this.rateLimitFilter.shouldLog()) {
      return false;
    }

    return true;
  }

  log(level, message, metadata = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, metadata);

    // Add to queue
    this.queue.push(logEntry);

    // Check if we should flush immediately (errors or queue full)
    if (level === 'ERROR' || level === 'FATAL' || this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  debug(message, metadata = {}) {
    this.log('DEBUG', message, metadata);
  }

  info(message, metadata = {}) {
    this.log('INFO', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('WARN', message, metadata);
  }

  error(message, metadata = {}) {
    // Ensure error objects are serializable
    if (metadata.error instanceof Error) {
      metadata.error = {
        name: metadata.error.name,
        message: metadata.error.message,
        stack: metadata.error.stack,
      };
    }
    this.log('ERROR', message, metadata);
  }

  fatal(message, metadata = {}) {
    if (metadata.error instanceof Error) {
      metadata.error = {
        name: metadata.error.name,
        message: metadata.error.message,
        stack: metadata.error.stack,
      };
    }
    this.log('FATAL', message, metadata);
    this.flush(); // Always flush fatal errors immediately
  }

  // Performance logging
  performance(operation, duration, metadata = {}) {
    const enrichedMetadata = {
      ...metadata,
      operation,
      duration,
      category: 'performance',
    };

    // Log slow operations as warnings
    if (duration > this.config.performance.slowThreshold) {
      this.warn(`Slow operation: ${operation} took ${duration}ms`, enrichedMetadata);
    } else if (Math.random() < this.config.performance.sampleRate) {
      this.info(`Performance: ${operation} - ${duration}ms`, enrichedMetadata);
    }
  }

  // Measure execution time of a function
  async measure(operation, fn, metadata = {}) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.performance(operation, duration, { ...metadata, success: true });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.performance(operation, duration, { ...metadata, success: false });
      this.error(`Operation failed: ${operation}`, { error, metadata });
      throw error;
    }
  }

  startBatchProcessing() {
    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.config.batchInterval);
  }

  stopBatchProcessing() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  async flush() {
    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.config.batchSize);

    // Send to all transports
    const promises = this.transports.map(transport => 
      transport.sendBatch(batch).catch(error => {
        console.error('Transport failed:', error);
      })
    );

    await Promise.allSettled(promises);
  }

  // Create a child logger with additional context
  child(context) {
    const childLogger = Object.create(this);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  // Cleanup
  async destroy() {
    this.stopBatchProcessing();
    await this.flush();
  }
}
