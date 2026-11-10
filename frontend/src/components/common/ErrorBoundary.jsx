import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 'clamp(2rem, 5vw, 4rem)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'inherit',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
              fontWeight: 700,
              color: '#111827',
              marginBottom: 'clamp(0.5rem, 1vh, 0.75rem)',
            }}
          >
            Something unexpected occurred
          </h2>
          <p
            style={{
              color: '#6B7280',
              fontSize: 'clamp(0.8125rem, 1.2vw, 0.95rem)',
              marginBottom: 'clamp(1.25rem, 2vh, 1.75rem)',
              maxWidth: 'min(90vw, 30rem)',
              lineHeight: 1.5,
            }}
          >
            {this.state.error?.message || 'A runtime error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: 'clamp(0.5rem, 1vh, 0.75rem) clamp(1.25rem, 2vw, 1.75rem)',
              backgroundColor: '#12151B',
              color: '#FFFFFF',
              borderRadius: '0.625rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
