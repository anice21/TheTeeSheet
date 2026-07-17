// Rate limiting filter to prevent log spam
export class RateLimitFilter {
  constructor(maxPerSecond = 10, maxPerMinute = 100) {
    this.maxPerSecond = maxPerSecond;
    this.maxPerMinute = maxPerMinute;
    this.secondBucket = [];
    this.minuteBucket = [];
  }

  shouldLog() {
    const now = Date.now();
    
    // Clean up old entries
    this.secondBucket = this.secondBucket.filter(t => now - t < 1000);
    this.minuteBucket = this.minuteBucket.filter(t => now - t < 60000);
    
    // Check limits
    if (this.secondBucket.length >= this.maxPerSecond) {
      return false;
    }
    if (this.minuteBucket.length >= this.maxPerMinute) {
      return false;
    }
    
    // Add timestamp
    this.secondBucket.push(now);
    this.minuteBucket.push(now);
    
    return true;
  }

  reset() {
    this.secondBucket = [];
    this.minuteBucket = [];
  }
}
