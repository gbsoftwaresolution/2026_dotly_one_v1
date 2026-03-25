import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { ShieldIcon } from "../components/icons";
import type { LoginCredentials } from "../types/user";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/app/vault/library";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const credentials: LoginCredentials = { email, password };
      await login(credentials);
      // Show post-login landing, then let the user continue to their intended route.
      navigate("/apps/dashboard", { replace: true, state: { next: from } });
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg-primary)",
      }}
    >
      {/* Left: Brand Side */}
      <div
        style={{
          flex: 1,
          background: "linear-gradient(135deg, #0f172a 0%, #000000 100%)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "var(--space-12)",
          overflow: "hidden",
        }}
        className="auth-brand-panel"
      >
        {/* Background Accents */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            right: "-20%",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0, 212, 255, 0.15) 0%, rgba(0,0,0,0) 70%)",
            filter: "blur(60px)",
            zIndex: 1,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            left: "-10%",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(121, 40, 202, 0.15) 0%, rgba(0,0,0,0) 70%)",
            filter: "blur(60px)",
            zIndex: 1,
          }}
        />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 10 }}>
          <Link
            to="/"
            style={{ textDecoration: "none", display: "inline-block" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "white",
              }}
            >
              <div style={{ color: "var(--accent-primary)" }}>
                <ShieldIcon size={28} />
              </div>
              <span
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                BoosterAi.me
              </span>
            </div>
          </Link>
        </div>

        <div style={{ position: "relative", zIndex: 10, maxWidth: "480px" }}>
          <h2
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              color: "white",
              lineHeight: 1.2,
              marginBottom: "var(--space-6)",
            }}
          >
            Secure your memories with absolute privacy.
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.6,
            }}
          >
            "The only photo storage solution I trust. The zero-knowledge
            encryption gives me peace of mind that my personal photos stay
            personal."
          </p>
          <div
            style={{
              marginTop: "var(--space-6)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "linear-gradient(45deg, #FF0080, #7928CA)",
              }}
            />
            <div>
              <div style={{ color: "white", fontWeight: 600 }}>Alex Chen</div>
              <div
                style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem" }}
              >
                Security Researcher
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 10,
            color: "rgba(255,255,255,0.3)",
            fontSize: "0.875rem",
          }}
        >
          © 2026 BoosterAi.me
        </div>
      </div>

      {/* Right: Form Side */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-8)",
          background: "var(--bg-primary)",
        }}
        className="auth-form-panel"
      >
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <div style={{ marginBottom: "var(--space-8)" }}>
            <h1
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: "var(--space-2)",
                color: "var(--text-primary)",
              }}
            >
              Welcome back
            </h1>
            <p style={{ color: "var(--text-secondary)" }}>
              Don't have an account?{" "}
              <Link
                to="/register"
                style={{ color: "var(--accent-primary)", fontWeight: 500 }}
              >
                Sign up for free
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "var(--space-5)" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                }}
              >
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "all 0.2s ease",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
                placeholder="name@company.com"
                onFocus={(e) =>
                  (e.target.style.borderColor = "var(--accent-primary)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--border-primary)")
                }
              />
            </div>

            <div style={{ marginBottom: "var(--space-6)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <label
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--accent-primary)",
                    fontWeight: 500,
                  }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "all 0.2s ease",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
                placeholder="••••••••••••"
                onFocus={(e) =>
                  (e.target.style.borderColor = "var(--accent-primary)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--border-primary)")
                }
              />
            </div>

            {error && (
              <div
                style={{
                  marginBottom: "var(--space-6)",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "rgba(255, 59, 48, 0.1)",
                  color: "#FF3B30",
                  fontSize: "0.9rem",
                  border: "1px solid rgba(255, 59, 48, 0.2)",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                background: "var(--accent-primary)",
                color: "white",
                fontSize: "1rem",
                fontWeight: 600,
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                transition: "transform 0.1s ease, background 0.2s ease",
                opacity: isLoading ? 0.7 : 1,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-1px)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "translateY(0)")
              }
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .auth-brand-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
