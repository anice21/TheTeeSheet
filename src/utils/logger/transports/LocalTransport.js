// IndexedDB transport for offline log storage
export class LocalTransport {
  constructor(config = {}) {
    this.dbName = config.dbName || 'golf-leaderboard-logs';
    this.storeName = config.storeName || 'logs';
    this.maxEntries = config.maxEntries || 1000;
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('level', 'level', { unique: false });
          store.createIndex('category', 'context.category', { unique: false });
        }
      };
    });
  }

  async send(logEntry) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.add({
        ...logEntry,
        storedAt: Date.now(),
      });

      request.onsuccess = () => {
        this.cleanup();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async sendBatch(logEntries) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      for (const entry of logEntries) {
        store.add({
          ...entry,
          storedAt: Date.now(),
        });
      }

      transaction.oncomplete = () => {
        this.cleanup();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async cleanup() {
    await this.initPromise;
    
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      const count = countRequest.result;
      
      if (count > this.maxEntries) {
        const deleteCount = count - this.maxEntries;
        const cursorRequest = store.openCursor();
        let deleted = 0;

        cursorRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && deleted < deleteCount) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
      }
    };
  }

  async getLogs(filter = {}) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        let logs = request.result;
        
        // Apply filters
        if (filter.level) {
          logs = logs.filter(log => log.level === filter.level);
        }
        if (filter.startTime) {
          logs = logs.filter(log => log.timestamp >= filter.startTime);
        }
        if (filter.endTime) {
          logs = logs.filter(log => log.timestamp <= filter.endTime);
        }
        
        resolve(logs);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
