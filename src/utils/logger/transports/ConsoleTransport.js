import { PrettyFormatter } from '../formatters/PrettyFormatter';

// Console transport for development logging
export class ConsoleTransport {
  constructor() {
    this.formatter = new PrettyFormatter();
    this.consoleMethods = {
      DEBUG: 'log',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
      FATAL: 'error',
    };
  }

  async send(logEntry) {
    const method = this.consoleMethods[logEntry.level] || 'log';
    const { output, styles, data } = this.formatter.format(logEntry);
    
    console[method](output, ...styles, ...data);
  }

  async sendBatch(logEntries) {
    for (const entry of logEntries) {
      await this.send(entry);
    }
  }
}
