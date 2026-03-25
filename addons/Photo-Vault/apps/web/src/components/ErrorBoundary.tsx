import type { ErrorInfo, ReactNode } from "react";
import React, { Component } from "react";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // You could send this error to an error reporting service like Sentry
    // reportErrorToService(error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleLogout = (): void => {
    // Clear any cached data
    if (window.localStorage) {
      window.localStorage.removeItem("booster_vault_master_key");
      window.localStorage.removeItem("booster_vault_encrypted_key_bundle");
    }

    // Clear session storage
    if (window.sessionStorage) {
      window.sessionStorage.clear();
    }

    // Revoke any object URLs
    this.revokeObjectURLs();

    // Navigate to login
    window.location.href = "/login";
  };

  private revokeObjectURLs(): void {
    // This is a best-effort cleanup of object URLs
    // In a real app, you'd want to track object URLs and revoke them properly
    // For now, we'll at least try to revoke any media blob URLs
    document.querySelectorAll("img, video").forEach((element) => {
      const src = element.getAttribute("src");
      if (src && src.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h1>Something went wrong</h1>
            <p className="error-message">
              The application encountered an unexpected error. We apologize for
              the inconvenience.
            </p>

            <div className="error-details">
              <details>
                <summary>Error Details</summary>
                <pre>{this.state.error?.toString()}</pre>
                <pre>{this.state.errorInfo?.componentStack}</pre>
              </details>
            </div>

            <div className="error-actions">
              <button
                type="button"
                onClick={this.handleReload}
                className="error-button error-button-reload"
              >
                Reload Application
              </button>

              <button
                type="button"
                onClick={this.handleLogout}
                className="error-button error-button-logout"
              >
                Logout & Return to Login
              </button>
            </div>

            <div className="error-help">
              <p>
                If the problem persists, please contact support or try clearing
                your browser cache.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to provide auth context if needed
const ErrorBoundary: React.FC<Props> = (props) => {
  return <ErrorBoundaryClass {...props} />;
};

export default ErrorBoundary;
