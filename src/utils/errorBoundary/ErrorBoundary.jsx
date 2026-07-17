import React from 'react';
import { getLogger } from '../logger';
import { ErrorFallback } from './ErrorFallback';

// Error Boundary component to catch React errors
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
    };
    this.logger = getLogger();
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const { componentName = 'Unknown' } = this.props;
    
    // Log the error
    this.logger.error(`React Error Boundary caught error in ${componentName}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      context: {
        component: componentName,
        category: 'ui',
      },
    });

    this.setState({ errorInfo });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    const { componentName = 'Unknown' } = this.props;
    
    this.logger.info(`Error boundary reset for ${componentName}`);
    
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null,
    });

    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetError: this.resetError,
        });
      }

      // Use default fallback
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.resetError}
          componentName={this.props.componentName}
        />
      );
    }

    return this.props.children;
  }
}
