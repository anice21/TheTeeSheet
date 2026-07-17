import { useEffect, useRef } from 'react';
import { useLogger } from '../logger/LoggerContext';

// Hook to measure and log component render performance
export function useRenderPerformance(componentName, enabled = true) {
  const logger = useLogger(componentName);
  const renderStartTime = useRef(null);
  const renderCount = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    renderCount.current++;
    
    if (renderStartTime.current) {
      const duration = performance.now() - renderStartTime.current;
      
      logger.performance(
        `${componentName}-render`,
        duration,
        {
          renderNumber: renderCount.current,
        }
      );
    }
  });

  // Mark render start time
  renderStartTime.current = performance.now();
}

// Hook to measure and log effect execution time
export function useEffectPerformance(effectName, dependencies = []) {
  const logger = useLogger();

  useEffect(() => {
    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      logger.performance(effectName, duration);
    };
  }, dependencies);
}

// Hook to measure and log async operation performance
export function useAsyncPerformance() {
  const logger = useLogger();

  return async (operation, fn, metadata = {}) => {
    return logger.measure(operation, fn, metadata);
  };
}

// Performance monitoring utility
export class PerformanceMonitor {
  constructor(logger) {
    this.logger = logger;
    this.marks = new Map();
  }

  mark(name) {
    this.marks.set(name, performance.now());
  }

  measure(name, startMark, metadata = {}) {
    const startTime = this.marks.get(startMark);
    if (!startTime) {
      this.logger.warn(`No mark found for ${startMark}`);
      return;
    }

    const duration = performance.now() - startTime;
    this.logger.performance(name, duration, metadata);
    this.marks.delete(startMark);
    
    return duration;
  }

  clear() {
    this.marks.clear();
  }
}

// Utility to detect long tasks
export function detectLongTasks(logger, threshold = 50) {
  if (typeof PerformanceObserver === 'undefined') {
    return null;
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > threshold) {
        logger.warn(`Long task detected: ${entry.duration}ms`, {
          entry: {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
          },
        });
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['longtask'] });
    return observer;
  } catch (e) {
    // Long task API not supported
    return null;
  }
}

// Web Vitals monitoring
export function monitorWebVitals(logger) {
  if (typeof PerformanceObserver === 'undefined') {
    return;
  }

  // Largest Contentful Paint (LCP)
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      logger.performance('LCP', lastEntry.renderTime || lastEntry.loadTime, {
        metric: 'largest-contentful-paint',
        element: lastEntry.element?.tagName,
      });
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    // Not supported
  }

  // First Input Delay (FID)
  try {
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        logger.performance('FID', entry.processingStart - entry.startTime, {
          metric: 'first-input-delay',
        });
      }
    });
    fidObserver.observe({ entryTypes: ['first-input'] });
  } catch (e) {
    // Not supported
  }

  // Cumulative Layout Shift (CLS)
  let clsValue = 0;
  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          logger.performance('CLS', clsValue, {
            metric: 'cumulative-layout-shift',
          });
        }
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  } catch (e) {
    // Not supported
  }
}
