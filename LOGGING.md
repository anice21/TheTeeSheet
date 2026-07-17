# Comprehensive Logging System Documentation

## Overview

The golf leaderboard application now includes a comprehensive logging system that provides:

- **Structured Logging**: JSON-formatted logs with consistent metadata
- **Multiple Transports**: Console (dev), Firebase (prod), and IndexedDB (offline)
- **Performance Monitoring**: Automatic tracking of operation durations
- **Error Tracking**: React Error Boundaries and global error handlers
- **Context Enrichment**: Automatic inclusion of user, session, and component context
- **Sampling & Rate Limiting**: Prevent log spam in production

---

## Quick Start

### Basic Usage in Components

```javascript
import { useLogger, useLogLifecycle } from '../utils/logger/LoggerContext';
import { LOG_CATEGORIES } from '../config/logging';

function MyComponent() {
  // Get a logger instance for this component
  const logger = useLogger('MyComponent');
  
  // Automatically log mount/unmount
  useLogLifecycle('MyComponent');
  
  const handleAction = async () => {
    logger.info('User clicked button', {
      buttonId: 'submit',
      category: LOG_CATEGORIES.UI,
    });
    
    try {
      const result = await someAsyncOperation();
      logger.info('Operation completed', { result });
    } catch (error) {
      logger.error('Operation failed', { error });
    }
  };
  
  return <button onClick={handleAction}>Submit</button>;
}
```

---

## Log Levels

Use appropriate log levels for different scenarios:

| Level | Use Case | Example |
|-------|----------|---------|
| **DEBUG** | Development diagnostics | `logger.debug('State updated', { newState })` |
| **INFO** | Important events | `logger.info('User logged in', { userId })` |
| **WARN** | Unexpected but handled | `logger.warn('API slow response', { duration })` |
| **ERROR** | Errors that need attention | `logger.error('Failed to save', { error })` |
| **FATAL** | Critical failures | `logger.fatal('Database unreachable', { error })` |

---

## Log Categories

Use predefined categories for consistent filtering:

```javascript
import { LOG_CATEGORIES } from '../config/logging';

// Available categories:
LOG_CATEGORIES.AUTH          // Authentication events
LOG_CATEGORIES.TRIP          // Trip management
LOG_CATEGORIES.ROUND         // Round management
LOG_CATEGORIES.SCORE         // Scoring operations
LOG_CATEGORIES.FIREBASE      // Firebase operations
LOG_CATEGORIES.PERFORMANCE   // Performance metrics
LOG_CATEGORIES.UI            // User interface events
LOG_CATEGORIES.NAVIGATION    // Navigation changes
```

---

## Logging Patterns

### 1. Component Lifecycle

```javascript
function MyComponent() {
  const logger = useLogger('MyComponent');
  
  // Logs mount and unmount automatically
  useLogLifecycle('MyComponent');
  
  useEffect(() => {
    logger.info('Data loaded', { recordCount: data.length });
  }, [data]);
}
```

### 2. User Actions

```javascript
const handleSubmit = async (formData) => {
  logger.info('Form submitted', {
    formType: 'tripCreation',
    category: LOG_CATEGORIES.TRIP,
  });
  
  try {
    await createTrip(formData);
    logger.info('Trip created successfully', { tripId: result.id });
  } catch (error) {
    logger.error('Failed to create trip', { error, formData });
  }
};
```

### 3. Firebase Operations

Use the Firebase logger utilities for automatic performance tracking:

```javascript
import { loggedGetDocs, loggedAddDoc } from '../utils/firebase';
import { collection, query, where } from 'firebase/firestore';

// Automatically logs and measures performance
const snapshot = await loggedGetDocs(
  query(collection(db, 'trips'), where('isActive', '==', true)),
  'trips',
  { operation: 'fetch-active-trips' }
);

// Or use the FirebaseLogger directly
import { FirebaseLogger } from '../utils/firebase';

const result = await FirebaseLogger.measureOperation(
  'complex-query',
  async () => {
    // Your Firebase operation
    return await getDocs(myQuery);
  },
  { userId, tripId }
);
```

### 4. Performance Monitoring

```javascript
import { useRenderPerformance } from '../utils/performance';

function ExpensiveComponent() {
  // Automatically log render performance
  useRenderPerformance('ExpensiveComponent');
  
  // Or manually measure specific operations
  const logger = useLogger('ExpensiveComponent');
  
  const processData = async () => {
    const start = performance.now();
    
    // ... expensive operation ...
    
    const duration = performance.now() - start;
    logger.performance('data-processing', duration, {
      recordCount: data.length,
    });
  };
  
  return <div>{/* ... */}</div>;
}
```

### 5. Error Handling

Error boundaries are automatically applied to all major components:

```javascript
// Already wrapped in App.jsx:
<ErrorBoundary componentName="MyComponent">
  <MyComponent />
</ErrorBoundary>

// Manual error logging:
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', {
    error,
    userId: user.id,
    context: { additionalInfo: 'value' },
  });
  
  // Show user-friendly message
  setErrorMessage('Something went wrong. Please try again.');
}
```

---

## Advanced Features

### Child Loggers with Additional Context

```javascript
function ParentComponent({ userId }) {
  const logger = useLogger('ParentComponent', { userId });
  
  // Child logger inherits parent context
  const childLogger = logger.child({ section: 'scorecard' });
  
  childLogger.info('Score updated'); 
  // Logs with: component='ParentComponent', userId, section='scorecard'
}
```

### Measuring Async Operations

```javascript
const logger = useLogger('MyComponent');

// Automatic measurement and logging
const result = await logger.measure(
  'fetch-user-data',
  async () => {
    const response = await fetch('/api/user');
    return response.json();
  },
  { userId: user.id }
);

// Logs performance automatically
// Logs errors if operation fails
```

### Performance Hooks

```javascript
import { useAsyncPerformance } from '../utils/performance';

function MyComponent() {
  const measureAsync = useAsyncPerformance();
  
  const fetchData = async () => {
    return measureAsync(
      'fetch-data',
      async () => {
        const response = await fetch('/api/data');
        return response.json();
      },
      { endpoint: '/api/data' }
    );
  };
}
```

---

## Configuration

Logging behavior is controlled by [src/config/logging.js](src/config/logging.js):

```javascript
export const loggingConfig = {
  enabled: true,
  minLevel: isDev ? 'DEBUG' : 'INFO',
  
  transports: {
    console: isDev,    // Console in development
    firebase: isProd,  // Firebase in production
    local: true,       // IndexedDB always enabled
  },
  
  sampling: {
    DEBUG: isDev ? 1.0 : 0.1,  // Sample 10% of DEBUG logs in prod
    INFO: 1.0,
    WARN: 1.0,
    ERROR: 1.0,
    FATAL: 1.0,
  },
  
  // Batch processing
  batchSize: 10,
  batchInterval: 5000,
  
  // Rate limiting
  rateLimit: {
    maxLogsPerMinute: 100,
    maxLogsPerSecond: 10,
  },
};
```

---

## Viewing Logs

### Development (Console)

Logs appear in the browser console with:
- Color-coded by level
- Component name
- Metadata expandable
- Pretty formatting

### Production (Firebase)

Logs are stored in Firestore collections:
- `logs/app/errors` - Error and fatal logs
- `logs/app/performance` - Performance metrics
- `logs/app/audit` - User actions and state changes
- `logs/app/analytics` - Business metrics

### Offline (IndexedDB)

All logs are stored locally in IndexedDB:
- Max 1000 entries
- Automatically cleaned up
- Available even when offline
- Syncs to Firebase when connection restored

To view local logs:

```javascript
import { LocalTransport } from './utils/logger/transports/LocalTransport';

const localTransport = new LocalTransport();
const logs = await localTransport.getLogs({
  level: 'ERROR',
  startTime: Date.now() - 3600000, // Last hour
});
console.log(logs);
```

---

## Best Practices

### ✅ DO

- **Use appropriate log levels**: DEBUG for diagnostics, INFO for important events, ERROR for failures
- **Include relevant context**: User IDs, trip IDs, operation names
- **Use categories**: Help filter and search logs later
- **Log user actions**: Button clicks, form submissions, navigation
- **Log errors with context**: Include what the user was trying to do
- **Measure performance**: Track slow operations
- **Use structured metadata**: Objects are better than string concatenation

### ❌ DON'T

- **Don't log sensitive data**: Passwords, tokens, credit cards
- **Don't log in loops**: Use sampling or aggregate metrics instead
- **Don't log too much**: Keep metadata relevant
- **Don't rely on logs for business logic**: Logs are for observability
- **Don't log raw error objects**: Extract message, name, and stack
- **Don't duplicate console.log**: Use the logger instead

---

## Examples from Codebase

### App.jsx - Authentication Logging

```javascript
useEffect(() => {
  const auth = getAuth();
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      logger.info('User authenticated', {
        userId: firebaseUser.uid,
        email: firebaseUser.email,
        category: LOG_CATEGORIES.AUTH,
      });
      logger.setContext({ userId: firebaseUser.uid });
    } else {
      logger.info('User logged out', {
        category: LOG_CATEGORIES.AUTH,
      });
      logger.clearContext();
    }
    setUser(firebaseUser);
  });
  return () => unsubscribe();
}, [logger]);
```

### TripScreen.jsx - Operation Logging

```javascript
const handleCreateTrip = async (e) => {
  logger.info('Creating trip', {
    tripName,
    location,
    category: LOG_CATEGORIES.TRIP,
  });

  try {
    const docRef = await addDoc(collection(db, 'trips'), tripData);
    
    logger.info('Trip created successfully', {
      tripId: docRef.id,
      tripName,
      category: LOG_CATEGORIES.TRIP,
    });
  } catch (error) {
    logger.error('Error creating trip', {
      error,
      tripName,
      category: LOG_CATEGORIES.TRIP,
    });
  }
};
```

---

## Troubleshooting

### Logs not appearing in console?

- Check `loggingConfig.enabled` is `true`
- Check `loggingConfig.minLevel` includes your log level
- Check `loggingConfig.transports.console` is `true`

### Too many logs in production?

- Adjust `sampling` rates in config
- Increase `minLevel` to `WARN` or `ERROR`
- Check `rateLimit` settings

### Firebase logs not being saved?

- Verify Firestore rules allow writes to `logs/` collection
- Check browser console for Firebase errors
- Ensure `db` is passed to `initLogger()` in main.jsx

### Performance impact?

- Logging is batched and async
- Sampling reduces volume in production
- Rate limiting prevents spam
- IndexedDB operations are non-blocking

---

## Firebase Security Rules

Add these rules to allow log writes:

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Existing rules...
    
    // Allow authenticated users to write logs
    match /logs/app/{logType}/{document=**} {
      allow write: if request.auth != null;
      allow read: if request.auth != null && 
        (request.auth.uid == resource.data.context.userId || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true);
    }
  }
}
```

---

## Future Enhancements

- [ ] Log aggregation dashboard
- [ ] Real-time error alerts
- [ ] Log export functionality
- [ ] Advanced filtering UI
- [ ] Performance trend charts
- [ ] User session replay
- [ ] Integration with external services (Sentry, LogRocket)

---

## Support

For questions or issues with the logging system, contact the development team or create an issue in the project repository.
