// Sampling filter to reduce log volume in production
export class SamplingFilter {
  constructor(sampleRates = {}) {
    this.sampleRates = sampleRates;
  }

  shouldLog(level) {
    const rate = this.sampleRates[level] ?? 1.0;
    return Math.random() < rate;
  }

  setSampleRate(level, rate) {
    this.sampleRates[level] = Math.max(0, Math.min(1, rate));
  }
}
