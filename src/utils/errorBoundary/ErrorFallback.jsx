import React from 'react';

// Error fallback component
export function ErrorFallback({ error, resetError, componentName }) {
  return (
    <div style={{
      padding: '20px',
      margin: '20px',
      border: '2px solid #EF4444',
      borderRadius: '8px',
      backgroundColor: '#FEE2E2',
      color: '#991B1B',
    }}>
      <h2 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 'bold' }}>
        Something went wrong {componentName ? `in ${componentName}` : ''}
      </h2>
      <details style={{ marginBottom: '10px', cursor: 'pointer' }}>
        <summary style={{ fontWeight: '600', marginBottom: '5px' }}>
          Error details
        </summary>
        <pre style={{
          fontSize: '12px',
          overflow: 'auto',
          padding: '10px',
          backgroundColor: '#FEF2F2',
          borderRadius: '4px',
          maxHeight: '200px',
        }}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
      </details>
      <button
        onClick={resetError}
        style={{
          padding: '8px 16px',
          backgroundColor: '#DC2626',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '600',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
