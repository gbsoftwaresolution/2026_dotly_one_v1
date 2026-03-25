import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { ShieldIcon, CheckIcon } from "../components/icons";
import type { RegisterData } from "../types/user";

export const Register: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const data: RegisterData = {
        email,
        password,
        displayName: displayName || undefined,
        locale: "en",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      await register(data);
      // Mirror login UX: show post-login landing.
      navigate("/apps/dashboard", {
        replace: true,
        state: { next: "/app/vault/library" },
      });
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
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
            Join thousands of privacy-conscious users.
          </h2>

          <ul style={{ listStyle: "none", padding: 0, marginTop: "20px" }}>
            {[
              "Zero-knowledge encryption standard",
              "Open source & auditable client",
              "No tracking, no ads, no data mining",
              "Fair and transparent pricing",
            ].map((item, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "1.05rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                  }}
                >
                  <CheckIcon size={14} />
                </div>
                {item}
              </li>
            ))}
          </ul>
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
              Create your account
            </h1>
            <p style={{ color: "var(--text-secondary)" }}>
              Already have an account?{" "}
              <Link
                to="/login"
                style={{ color: "var(--accent-primary)", fontWeight: 500 }}
              >
                Sign in
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
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
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
                placeholder="Jane Doe"
                onFocus={(e) =>
                  (e.target.style.borderColor = "var(--accent-primary)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--border-primary)")
                }
              />
            </div>

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
                Password
              </label>
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
                placeholder="At least 8 characters"
                onFocus={(e) =>
                  (e.target.style.borderColor = "var(--accent-primary)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--border-primary)")
                }
              />
            </div>

            <div style={{ marginBottom: "var(--space-6)" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                placeholder="Repeat your password"
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
              {isLoading ? "Creating account..." : "Create account"}
            </button>

            <p
              style={{
                marginTop: "var(--space-6)",
                fontSize: "0.8rem",
                color: "var(--text-tertiary)",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              By creating an account, you agree to our{" "}
              <Link to="/terms" style={{ color: "var(--text-secondary)" }}>
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy-policy"
                style={{ color: "var(--text-secondary)" }}
              >
                Privacy Policy
              </Link>
              .
            </p>
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
