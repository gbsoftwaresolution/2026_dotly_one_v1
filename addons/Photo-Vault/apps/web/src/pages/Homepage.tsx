import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MarketingHeader } from "../components/MarketingHeader";
import { MarketingFooter } from "../components/MarketingFooter";
import {
  LockIcon,
  ShieldIcon,
  DownloadIcon,
  EyeOffIcon,
  CheckIcon,
  DeviceIcon,
  CloudIcon,
} from "../components/icons";

export default function Homepage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-primary)",
        overflowX: "hidden",
      }}
    >
      <MarketingHeader />

      {/* ================= HERO SECTION ================= */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-20) var(--space-6)",
          overflow: "hidden",
          marginTop: "-80px", // Offset header height for full bleed
        }}
      >
        {/* Dynamic Background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, #050505 0%, #0a0a0a 100%)",
            zIndex: -2,
          }}
        />

        {/* Animated Orbs */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: `translate(-50%, ${scrollY * 0.2}px)`,
            width: "800px",
            height: "800px",
            background:
              "radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, transparent 70%)",
            filter: "blur(80px)",
            borderRadius: "50%",
            zIndex: -1,
            opacity: 0.8,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            right: "10%",
            transform: `translate(0, ${scrollY * -0.1}px)`,
            width: "600px",
            height: "600px",
            background:
              "radial-gradient(circle, rgba(0, 212, 255, 0.08) 0%, transparent 70%)",
            filter: "blur(60px)",
            borderRadius: "50%",
            zIndex: -1,
          }}
        />

        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            textAlign: "center",
            position: "relative",
            zIndex: 10,
          }}
        >
          {/* Badge */}
          <div className="animate-slide-up" style={{ animationDelay: "0ms" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "9999px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 500,
                marginBottom: "var(--space-8)",
                backdropFilter: "blur(10px)",
              }}
            >
              <span
                style={{
                  color: "var(--success)",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <circle cx="5" cy="5" r="4" fill="currentColor" />
                </svg>
              </span>
              <span>System Operational</span>
              <span style={{ opacity: 0.3, margin: "0 4px" }}>|</span>
              <span style={{ color: "var(--accent-primary)" }}>v2.0 Live</span>
            </span>
          </div>

          <h1
            className="animate-slide-up"
            style={{
              fontSize: "clamp(3.5rem, 8vw, 7rem)",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              marginBottom: "var(--space-8)",
              animationDelay: "100ms",
            }}
          >
            <span style={{ color: "white" }}>The Vault for Your</span>
            <br />
            <span
              style={{
                background:
                  "linear-gradient(135deg, var(--accent-primary) 0%, #a855f7 50%, #ec4899 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 40px rgba(124, 58, 237, 0.3))",
              }}
            >
              Digital Life.
            </span>
          </h1>

          <p
            className="animate-slide-up"
            style={{
              fontSize: "clamp(1.125rem, 2vw, 1.5rem)",
              color: "var(--text-secondary)",
              maxWidth: "640px",
              margin: "0 auto var(--space-10)",
              lineHeight: 1.6,
              animationDelay: "200ms",
            }}
          >
            True zero-knowledge cloud storage. Photos and videos encrypted on
            your device, keys that stay in your pocket.
          </p>

          <div
            className="animate-slide-up"
            style={{
              display: "flex",
              gap: "var(--space-4)",
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              animationDelay: "300ms",
              marginBottom: "var(--space-16)",
            }}
          >
            <Link
              to="/register"
              className="btn"
              style={{
                padding: "18px 40px",
                fontSize: "1.125rem",
                fontWeight: 600,
                borderRadius: "9999px",
                background: "white",
                color: "black",
                border: "none",
                boxShadow: "0 0 40px rgba(255, 255, 255, 0.2)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow =
                  "0 0 60px rgba(255, 255, 255, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 0 40px rgba(255, 255, 255, 0.2)";
              }}
            >
              Start Free Vault
            </Link>
            <Link
              to="/how-encryption-works"
              className="btn"
              style={{
                padding: "18px 40px",
                fontSize: "1.125rem",
                fontWeight: 500,
                borderRadius: "9999px",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(10px)",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
              }
            >
              How it works
            </Link>
          </div>

          {/* Social Proof / Security Badge */}
          <div
            className="animate-slide-up"
            style={{
              animationDelay: "400ms",
              display: "flex",
              justifyContent: "center",
              gap: "24px",
              opacity: 0.6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              <ShieldIcon size={18} /> Audited Architecture
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              <LockIcon size={18} /> AES-256 + Argon2id
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              <CloudIcon size={18} /> Global Redundancy
            </div>
          </div>
        </div>
      </section>

      {/* ================= PROBLEM / SOLUTION ================= */}
      <section
        style={{
          padding: "var(--space-20) var(--space-6)",
          backgroundColor: "#0a0a0a",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "var(--space-12)",
              alignItems: "center",
            }}
          >
            {/* The PROBLEM */}
            <div style={{ opacity: 0.8, padding: "var(--space-8)" }}>
              <div style={{ marginBottom: "var(--space-8)" }}>
                <div
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--text-tertiary)",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    marginBottom: "16px",
                  }}
                >
                  legacy cloud storage
                </div>
                <h3
                  style={{
                    fontSize: "2rem",
                    color: "var(--text-secondary)",
                    marginBottom: "16px",
                  }}
                >
                  The Privacy Tax
                </h3>
                <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Most "free" photo apps aren't free. You pay with your data,
                  facial scans, and privacy.
                </p>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                }}
              >
                {[
                  "Scans photos for ad targeting",
                  "Trains AI models on your faces",
                  "Staff can access unencrypted files",
                  "Compliance with bulk data requests",
                ].map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      color: "var(--text-disabled)",
                      fontSize: "1.1rem",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--danger)",
                        display: "flex",
                        alignItems: "center",
                        opacity: 0.7,
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* The SOLUTION */}
            <div
              style={{
                background:
                  "linear-gradient(145deg, rgba(20, 20, 20, 0.8) 0%, rgba(10, 10, 10, 0.9) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "32px",
                padding: "48px",
                boxShadow: "0 40px 100px -20px rgba(0, 0, 0, 0.8)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Glow Effect */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: "100%",
                  height: "100%",
                  background:
                    "radial-gradient(circle at 100% 0%, rgba(0, 212, 255, 0.1) 0%, transparent 60%)",
                  pointerEvents: "none",
                }}
              />

              <div style={{ marginBottom: "40px", position: "relative" }}>
                <div
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--accent-primary)",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    marginBottom: "16px",
                  }}
                >
                  The BoosterAi.me Standard
                </div>
                <h3
                  style={{
                    fontSize: "2.5rem",
                    color: "white",
                    marginBottom: "16px",
                  }}
                >
                  Zero Compromise
                </h3>
                <p
                  style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}
                >
                  We mathematically cannot see your data. It's not a policy,
                  it's architecture.
                </p>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                  position: "relative",
                }}
              >
                {[
                  "Client-side XChaCha20 encryption",
                  "No AI training or facial recognition",
                  "Zero-knowledge architecture",
                  "You hold the only decryption keys",
                ].map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      fontSize: "1.15rem",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, var(--success) 0%, #10b981 100%)",
                        color: "black",
                        boxShadow: "0 0 15px rgba(52, 211, 153, 0.4)",
                      }}
                    >
                      <CheckIcon size={16} />
                    </span>
                    <span style={{ color: "white" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BENTO GRID FEATURES ================= */}
      <section
        style={{
          padding: "var(--space-32) var(--space-6)",
          position: "relative",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "80px" }}>
            <h2
              style={{
                fontSize: "3.5rem",
                marginBottom: "24px",
                fontWeight: 800,
              }}
            >
              Engineered for Privacy
            </h2>
            <p style={{ fontSize: "1.25rem", color: "var(--text-secondary)" }}>
              Advanced features. Simple experience.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: "24px",
              gridAutoRows: "minmax(300px, auto)",
            }}
          >
            {/* Feature 1: Encryption (Large) */}
            <div
              className="bento-card"
              style={{
                gridColumn: "span 7",
                background: "linear-gradient(145deg, #111, #050505)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "32px",
                padding: "48px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    marginBottom: "32px",
                    color: "var(--accent-primary)",
                  }}
                >
                  <ShieldIcon size={48} />
                </div>
                <h3
                  style={{
                    fontSize: "2rem",
                    marginBottom: "16px",
                    color: "white",
                  }}
                >
                  Military-Grade Encryption
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "1.1rem",
                    maxWidth: "90%",
                    lineHeight: 1.6,
                  }}
                >
                  Your photos are encrypted with XChaCha20-Poly1305 before they
                  ever leave your device. The server sees only blobs of random
                  noise.
                </p>
              </div>
              <div
                style={{
                  position: "absolute",
                  right: "-20%",
                  bottom: "-40%",
                  width: "500px",
                  height: "500px",
                  background:
                    "radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}
              />
            </div>

            {/* Feature 2: No AI (Tall) */}
            <div
              className="bento-card"
              style={{
                gridColumn: "span 5",
                gridRow: "span 2",
                background: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "32px",
                padding: "40px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "200px",
                  background:
                    "linear-gradient(180deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%)",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.03)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "32px",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "var(--danger)",
                  boxShadow: "0 0 30px rgba(239, 68, 68, 0.1)",
                }}
              >
                <EyeOffIcon size={56} />
              </div>
              <h3
                style={{
                  fontSize: "2rem",
                  marginBottom: "16px",
                  color: "white",
                }}
              >
                No AI Training
              </h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "1.1rem",
                  lineHeight: 1.6,
                }}
              >
                We don't scan your photos to train models or sell your habits.
                Your memories are not our product.
              </p>
            </div>

            {/* Feature 3: Ownership (Medium) */}
            <div
              className="bento-card"
              style={{
                gridColumn: "span 4",
                background: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "32px",
                padding: "32px",
                minHeight: "280px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              <div style={{ marginBottom: "auto", color: "var(--success)" }}>
                <DownloadIcon size={32} />
              </div>
              <h4
                style={{
                  fontSize: "1.5rem",
                  marginBottom: "12px",
                  color: "white",
                }}
              >
                Total Ownership
              </h4>
              <p style={{ color: "var(--text-secondary)" }}>
                Export your entire encrypted vault as a standard ZIP file
                instantly.
              </p>
            </div>

            {/* Feature 4: Device Sync (Medium) */}
            <div
              className="bento-card"
              style={{
                gridColumn: "span 3",
                background: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "32px",
                padding: "32px",
                minHeight: "280px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  marginBottom: "auto",
                  color: "var(--accent-secondary)",
                }}
              >
                <DeviceIcon size={32} />
              </div>
              <h4
                style={{
                  fontSize: "1.5rem",
                  marginBottom: "12px",
                  color: "white",
                }}
              >
                Multi-Device
              </h4>
              <p style={{ color: "var(--text-secondary)" }}>
                Access your vault from any device, anywhere.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TECH SPECS / TRUST ================= */}
      <section
        style={{
          padding: "var(--space-20) var(--space-6)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "#0a0a0a",
        }}
      >
        <div
          style={{ maxWidth: "1000px", margin: "0 auto", textAlign: "center" }}
        >
          <p
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              marginBottom: "var(--space-12)",
              opacity: 0.7,
            }}
          >
            Powered by modern cryptography
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--space-8)",
            }}
          >
            {[
              { label: "Cipher", val: "XChaCha20-Poly1305" },
              { label: "Key Derivation", val: "Argon2id" },
              { label: "Architecture", val: "Zero-Knowledge" },
              { label: "Platform", val: "WebCrypto API" },
            ].map((spec, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "white",
                    marginBottom: "4px",
                  }}
                >
                  {spec.val}
                </div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {spec.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section
        style={{
          padding: "160px var(--space-6)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background Glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(circle, rgba(124, 58, 237, 0.05) 0%, transparent 60%)",
            pointerEvents: "none",
            zIndex: -1,
          }}
        />

        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              marginBottom: "var(--space-8)",
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            Claim Your Privacy.
          </h2>
          <p
            style={{
              fontSize: "1.25rem",
              color: "var(--text-secondary)",
              marginBottom: "var(--space-12)",
              lineHeight: 1.6,
            }}
          >
            Join thousands of users who have decided their digital life belongs
            to them.
            <br />
            Start with 50 photos free. No credit card required.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <Link
              to="/register"
              className="btn"
              style={{
                padding: "20px 48px",
                fontSize: "1.25rem",
                borderRadius: "9999px",
                background: "white",
                color: "black",
                fontWeight: 600,
                border: "none",
                boxShadow: "0 0 50px rgba(255, 255, 255, 0.15)",
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.05)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              Create Your Vault
            </Link>
            <div
              style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}
            >
              14-day free trial on Pro plans • Cancel anytime
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />

      {/* Inline Styles for Responsive Grid (Media Queries in JS are messy, ideally use CSS) */}
      <style>{`
        @media (max-width: 900px) {
          .bento-card { grid-column: span 12 !important; }
        }
        @keyframes slide-up {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
