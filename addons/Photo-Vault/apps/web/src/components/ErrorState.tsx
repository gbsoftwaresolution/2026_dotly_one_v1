import React from "react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div
      style={{
        padding: "3rem",
        textAlign: "center",
        backgroundColor: "#fff",
        borderRadius: "8px",
        border: "1px solid #eaeaea",
      }}
    >
      <div style={{ marginBottom: "1rem", color: "#dc3545" }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h3 style={{ marginBottom: "0.5rem", color: "#dc3545" }}>Error</h3>
      <p style={{ marginBottom: "1.5rem", color: "#6c757d" }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "0.5rem 1.5rem",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
};
