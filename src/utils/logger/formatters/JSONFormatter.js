// JSON formatter for structured logging
export class JSONFormatter {
  format(logEntry) {
    return JSON.stringify(logEntry);
  }

  parse(logString) {
    try {
      return JSON.parse(logString);
    } catch (error) {
      return null;
    }
  }
}
