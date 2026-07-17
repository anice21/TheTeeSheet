import { getLogger } from '../logger';
import { LOG_CATEGORIES } from '../../config/logging';

// Create a logger for Firebase operations
const firebaseLogger = getLogger().child({ category: LOG_CATEGORIES.FIREBASE });

/**
 * Wrapper for Firebase operations with automatic logging
 */
export class FirebaseLogger {
  /**
   * Log a Firestore read operation
   */
  static logRead(collection, operation, metadata = {}) {
    firebaseLogger.debug(`Firestore read: ${collection}`, {
      operation,
      collection,
      ...metadata,
    });
  }

  /**
   * Log a Firestore write operation
   */
  static logWrite(collection, operation, metadata = {}) {
    firebaseLogger.info(`Firestore write: ${collection}`, {
      operation,
      collection,
      ...metadata,
    });
  }

  /**
   * Log a Firestore error
   */
  static logError(operation, error, metadata = {}) {
    firebaseLogger.error(`Firestore error: ${operation}`, {
      error: {
        code: error.code,
        message: error.message,
        name: error.name,
      },
      operation,
      ...metadata,
    });
  }

  /**
   * Measure and log performance of a Firebase operation
   */
  static async measureOperation(operation, fn, metadata = {}) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      firebaseLogger.performance(
        `firebase-${operation}`,
        duration,
        metadata
      );
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      firebaseLogger.performance(
        `firebase-${operation}`,
        duration,
        { ...metadata, success: false }
      );
      
      this.logError(operation, error, metadata);
      throw error;
    }
  }

  /**
   * Log authentication events
   */
  static logAuth(event, metadata = {}) {
    firebaseLogger.info(`Auth: ${event}`, {
      event,
      category: LOG_CATEGORIES.AUTH,
      ...metadata,
    });
  }
}

/**
 * Wrapper functions for common Firebase operations
 */

export async function loggedGetDocs(query, collectionName, metadata = {}) {
  FirebaseLogger.logRead(collectionName, 'getDocs', metadata);
  
  return FirebaseLogger.measureOperation(
    `getDocs-${collectionName}`,
    async () => {
      const { getDocs } = await import('firebase/firestore');
      return getDocs(query);
    },
    { collection: collectionName, ...metadata }
  );
}

export async function loggedAddDoc(collectionRef, data, collectionName, metadata = {}) {
  FirebaseLogger.logWrite(collectionName, 'addDoc', {
    ...metadata,
    dataKeys: Object.keys(data),
  });
  
  return FirebaseLogger.measureOperation(
    `addDoc-${collectionName}`,
    async () => {
      const { addDoc } = await import('firebase/firestore');
      return addDoc(collectionRef, data);
    },
    { collection: collectionName, ...metadata }
  );
}

export async function loggedUpdateDoc(docRef, data, collectionName, metadata = {}) {
  FirebaseLogger.logWrite(collectionName, 'updateDoc', {
    ...metadata,
    dataKeys: Object.keys(data),
  });
  
  return FirebaseLogger.measureOperation(
    `updateDoc-${collectionName}`,
    async () => {
      const { updateDoc } = await import('firebase/firestore');
      return updateDoc(docRef, data);
    },
    { collection: collectionName, ...metadata }
  );
}

export async function loggedDeleteDoc(docRef, collectionName, metadata = {}) {
  FirebaseLogger.logWrite(collectionName, 'deleteDoc', metadata);
  
  return FirebaseLogger.measureOperation(
    `deleteDoc-${collectionName}`,
    async () => {
      const { deleteDoc } = await import('firebase/firestore');
      return deleteDoc(docRef);
    },
    { collection: collectionName, ...metadata }
  );
}

export async function loggedSetDoc(docRef, data, collectionName, metadata = {}) {
  FirebaseLogger.logWrite(collectionName, 'setDoc', {
    ...metadata,
    dataKeys: Object.keys(data),
  });
  
  return FirebaseLogger.measureOperation(
    `setDoc-${collectionName}`,
    async () => {
      const { setDoc } = await import('firebase/firestore');
      return setDoc(docRef, data);
    },
    { collection: collectionName, ...metadata }
  );
}
