// Pretty formatter for console output in development
export class PrettyFormatter {
  constructor() {
    this.colors = {
      DEBUG: '#9CA3AF',
      INFO: '#3B82F6',
      WARN: '#F59E0B',
      ERROR: '#EF4444',
      FATAL: '#DC2626',
    };
  }

  format(logEntry) {
    const { timestamp, level, message, context, metadata } = logEntry;
    const color = this.colors[level] || '#000000';
    const time = new Date(timestamp).toLocaleTimeString();
    
    let output = `%c[${time}] ${level}%c ${context?.component || 'APP'}`;
    
    if (context?.action) {
      output += ` → ${context.action}`;
    }
    
    output += `\n  ${message}`;
    
    const styles = [
      `color: ${color}; font-weight: bold`,
      'color: inherit; font-weight: normal',
    ];

    const data = [];
    if (metadata && Object.keys(metadata).length > 0) {
      data.push('\n  Metadata:', metadata);
    }

    return { output, styles, data };
  }
}
