import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { getLogger, initLogger } from './index';

const LoggerContext = createContext(null);

// Provider component
export function LoggerProvider({ children, db, userId }) {
  const [logger, setLogger] = useState(null);

  useEffect(() => {
    const loggerInstance = initLogger(db);
    
    // Set user context if available
    if (userId) {
      loggerInstance.setContext({ userId });
    }

    setLogger(loggerInstance);

    // Cleanup on unmount
    return () => {
      if (loggerInstance) {
        loggerInstance.destroy();
      }
    };
  }, [db, userId]);

  // Update user context when it changes
  useEffect(() => {
    if (logger && userId) {
      logger.setContext({ userId });
    }
  }, [logger, userId]);

  return (
    <LoggerContext.Provider value={logger}>
      {children}
    </LoggerContext.Provider>
  );
}

// Hook to use logger in components
export function useLogger(component = null, additionalContext = {}) {
  const logger = useContext(LoggerContext);

  const contextualLogger = useMemo(() => {
    if (!logger) {
      return getLogger(); // Fallback to global logger
    }

    if (component) {
      return logger.child({ component, ...additionalContext });
    }

    return logger;
  }, [logger, component, JSON.stringify(additionalContext)]);

  return contextualLogger;
}

// Hook to log component lifecycle
export function useLogLifecycle(componentName) {
  const logger = useLogger(componentName);

  useEffect(() => {
    logger.debug(`${componentName} mounted`);
    
    return () => {
      logger.debug(`${componentName} unmounted`);
    };
  }, [componentName, logger]);
}

// Hook to measure and log performance
export function usePerformanceLog(operation, dependencies = []) {
  const logger = useLogger();

  useEffect(() => {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      logger.performance(operation, duration);
    };
  }, dependencies);
}
