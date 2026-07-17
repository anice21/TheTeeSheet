import { Logger } from './Logger';
import { loggingConfig } from '../../config/logging';

// Global logger instance
let globalLogger = null;

// Initialize the global logger
export function initLogger(db = null, config = {}) {
  if (!globalLogger) {
    globalLogger = new Logger({ ...loggingConfig, ...config }, db);
  }
  return globalLogger;
}

// Get the global logger instance
export function getLogger() {
  if (!globalLogger) {
    globalLogger = new Logger(loggingConfig);
  }
  return globalLogger;
}

// Create a logger with component context
export function createLogger(component, additionalContext = {}) {
  const logger = getLogger();
  return logger.child({ component, ...additionalContext });
}

// Export Logger class for custom instances
export { Logger } from './Logger';
export { LOG_LEVELS, LOG_CATEGORIES } from '../../config/logging';
