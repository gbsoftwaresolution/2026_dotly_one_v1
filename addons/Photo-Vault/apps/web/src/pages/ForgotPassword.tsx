import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/auth";

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authApi.forgotPassword(email);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to send password reset email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#f8f9fa",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "2rem",
          backgroundColor: "#fff",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          Forgot Password
        </h1>

        {isSubmitted ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: "1rem", color: "#28a745" }}>
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
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ marginBottom: "1.5rem", color: "#6c757d" }}>
              If an account exists with {email}, you will receive password reset
              instructions.
            </p>
            <Link
              to="/login"
              style={{
                display: "inline-block",
                padding: "0.75rem 1.5rem",
                backgroundColor: "#007bff",
                color: "#fff",
                textDecoration: "none",
                borderRadius: "4px",
                fontWeight: "500",
              }}
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#f8d7da",
                  border: "1px solid #f5c6cb",
                  borderRadius: "4px",
                  color: "#721c24",
                  marginBottom: "1rem",
                }}
              >
                {error}
              </div>
            )}

            <p
              style={{
                marginBottom: "1.5rem",
                color: "#6c757d",
                textAlign: "center",
              }}
            >
              Enter your email address and we'll send you instructions to reset
              your password.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "500",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #dee2e6",
                    borderRadius: "4px",
                    fontSize: "1rem",
                  }}
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  backgroundColor: isLoading ? "#6c757d" : "#007bff",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "1rem",
                  fontWeight: "500",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? "Sending..." : "Send Reset Instructions"}
              </button>
            </form>

            <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
              <Link
                to="/login"
                style={{ color: "#007bff", textDecoration: "none" }}
              >
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
