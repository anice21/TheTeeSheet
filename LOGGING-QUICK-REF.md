# Logging System - Quick Reference

## Import the Logger

```javascript
import { useLogger, useLogLifecycle } from '../utils/logger/LoggerContext';
import { LOG_CATEGORIES } from '../config/logging';
```

## Basic Usage

```javascript
function MyComponent() {
  const logger = useLogger('MyComponent');
  useLogLifecycle('MyComponent'); // Auto-log mount/unmount
  
  // Log levels
  logger.debug('Debug message', { data });
  logger.info('Info message', { data });
  logger.warn('Warning message', { data });
  logger.error('Error message', { error, data });
  logger.fatal('Fatal error', { error });
  
  // Performance
  logger.performance('operation-name', durationMs, { metadata });
}
```

## Log Categories

```javascript
LOG_CATEGORIES.AUTH          // Authentication
LOG_CATEGORIES.TRIP          // Trip management
LOG_CATEGORIES.ROUND         // Round management
LOG_CATEGORIES.SCORE         // Scoring
LOG_CATEGORIES.FIREBASE      // Firebase operations
LOG_CATEGORIES.PERFORMANCE   // Performance metrics
LOG_CATEGORIES.UI            // User interface
LOG_CATEGORIES.NAVIGATION    // Navigation
```

## Firebase Logging

```javascript
import { loggedGetDocs, loggedAddDoc } from '../utils/firebase';

const snapshot = await loggedGetDocs(query, 'collection-name', { metadata });
const docRef = await loggedAddDoc(ref, data, 'collection-name', { metadata });
```

## Error Boundaries

Already applied to all major components. To add to new components:

```javascript
import { ErrorBoundary } from '../utils/errorBoundary';

<ErrorBoundary componentName="MyComponent">
  <MyComponent />
</ErrorBoundary>
```

## Performance Monitoring

```javascript
import { useRenderPerformance } from '../utils/performance';

function MyComponent() {
  useRenderPerformance('MyComponent');
  // Automatically logs render times
}
```

## Measure Async Operations

```javascript
const result = await logger.measure(
  'operation-name',
  async () => {
    // Your async operation
    return await doSomething();
  },
  { metadata }
);
```

---

See [LOGGING.md](LOGGING.md) for comprehensive documentation.
