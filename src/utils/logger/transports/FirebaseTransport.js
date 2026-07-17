import { collection, addDoc, Timestamp } from 'firebase/firestore';

// Firebase transport for production logging
export class FirebaseTransport {
  constructor(db, collections = {}) {
    this.db = db;
    this.collections = collections;
    this.queue = [];
    this.sending = false;
  }

  getCollectionPath(logEntry) {
    const { level, context } = logEntry;
    
    // Route to appropriate collection based on category
    if (level === 'ERROR' || level === 'FATAL') {
      return this.collections.errors;
    }
    
    if (context?.category === 'performance') {
      return this.collections.performance;
    }
    
    if (context?.category === 'authentication' || context?.category === 'trip_management') {
      return this.collections.audit;
    }
    
    return this.collections.analytics;
  }

  async send(logEntry) {
    try {
      const collectionPath = this.getCollectionPath(logEntry);
      
      // Convert ISO timestamp to Firestore Timestamp
      const firestoreEntry = {
        ...logEntry,
        timestamp: Timestamp.fromDate(new Date(logEntry.timestamp)),
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(this.db, collectionPath), firestoreEntry);
    } catch (error) {
      // Fail silently in production to not break app
      console.error('Failed to send log to Firebase:', error);
    }
  }

  async sendBatch(logEntries) {
    // Group by collection
    const grouped = {};
    
    for (const entry of logEntries) {
      const path = this.getCollectionPath(entry);
      if (!grouped[path]) {
        grouped[path] = [];
      }
      grouped[path].push(entry);
    }

    // Send all batches
    const promises = [];
    for (const [path, entries] of Object.entries(grouped)) {
      for (const entry of entries) {
        promises.push(
          addDoc(collection(this.db, path), {
            ...entry,
            timestamp: Timestamp.fromDate(new Date(entry.timestamp)),
            createdAt: Timestamp.now(),
          }).catch(error => {
            console.error('Failed to send log batch to Firebase:', error);
          })
        );
      }
    }

    await Promise.allSettled(promises);
  }
}
