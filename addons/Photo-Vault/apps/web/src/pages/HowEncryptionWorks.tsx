import { Link } from "react-router-dom";
import { MarketingHeader } from "../components/MarketingHeader";
import { MarketingFooter } from "../components/MarketingFooter";
import {
  ShieldIcon,
  LockIcon,
  CloudIcon,
  EyeOffIcon,
  KeyIcon,
  DeviceIcon,
  SearchIcon,
} from "../components/icons";

export const HowEncryptionWorks = () => {
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
          padding: "var(--space-20) var(--space-6)",
          textAlign: "center",
          background:
            "linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div
            className="animate-slide-up"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(0, 212, 255, 0.1)",
              padding: "8px 16px",
              borderRadius: "999px",
              color: "var(--accent-primary)",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "var(--space-8)",
            }}
          >
            <ShieldIcon size={16} /> Transparent Security Model
          </div>

          <h1
            className="animate-slide-up"
            style={{
              fontSize: "clamp(3rem, 5vw, 4.5rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: "var(--space-8)",
              animationDelay: "100ms",
            }}
          >
            We cannot see your photos.
            <br />
            <span style={{ color: "var(--text-secondary)" }}>Here is why.</span>
          </h1>

          <p
            className="animate-slide-up"
            style={{
              fontSize: "1.25rem",
              color: "var(--text-secondary)",
              marginBottom: "var(--space-12)",
              maxWidth: "700px",
              margin: "0 auto var(--space-12)",
              lineHeight: 1.6,
              animationDelay: "200ms",
            }}
          >
            BoosterAi.me uses client-side encryption. Your files are encrypted
            in your browser before they ever reach our servers. This is not just
            marketing language. It's mathematical fact.
          </p>
        </div>
      </section>

      {/* ================= VISUAL FLOW SECTION ================= */}
      <section
        style={{ padding: "var(--space-10) var(--space-6) var(--space-24)" }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div
            className="process-flow animate-slide-up"
            style={{
              animationDelay: "300ms",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "var(--space-8)",
              position: "relative",
            }}
          >
            {/* Step 1: Your Device */}
            <div
              className="flow-step"
              style={{ textAlign: "center", position: "relative", zIndex: 2 }}
            >
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "2px solid var(--success)",
                  width: "120px",
                  height: "120px",
                  borderRadius: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                  boxShadow: "0 0 30px rgba(0, 255, 136, 0.1)",
                }}
              >
                <div style={{ color: "var(--success)" }}>
                  <DeviceIcon size={48} />
                </div>
              </div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>
                Your Device
              </h3>
              <p
                style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}
              >
                Unencrypted Photo
              </p>
            </div>

            {/* Arrow & Lock */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                color: "var(--text-tertiary)",
                flex: "1",
                minWidth: "100px",
                maxWidth: "200px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "2px",
                  background:
                    "linear-gradient(90deg, var(--success) 0%, var(--accent-primary) 100%)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "var(--bg-primary)",
                    padding: "8px",
                    borderRadius: "50%",
                    border: "1px solid var(--border-primary)",
                  }}
                >
                  <div style={{ color: "var(--accent-primary)" }}>
                    <LockIcon size={20} />
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Encryption
              </span>
            </div>

            {/* Step 2: Encrypted Blob */}
            <div
              className="flow-step"
              style={{ textAlign: "center", position: "relative", zIndex: 2 }}
            >
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "2px solid var(--accent-primary)",
                  width: "120px",
                  height: "120px",
                  borderRadius: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                  boxShadow: "0 0 30px rgba(124, 58, 237, 0.15)",
                }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    color: "var(--accent-primary)",
                    lineHeight: 1,
                    opacity: 0.7,
                  }}
                >
                  0110 A7F2
                  <br />
                  9B3C 1101
                  <br />
                  D4E1 ...
                </div>
              </div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>
                Encrypted Blob
              </h3>
              <p
                style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}
              >
                Unreadable Data
              </p>
            </div>

            {/* Arrow & Cloud */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                color: "var(--text-tertiary)",
                flex: "1",
                minWidth: "100px",
                maxWidth: "200px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "2px",
                  background:
                    "linear-gradient(90deg, var(--accent-primary) 0%, var(--danger) 100%)",
                  position: "relative",
                }}
              />
              <span
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Upload
              </span>
            </div>

            {/* Step 3: Our Servers */}
            <div
              className="flow-step"
              style={{ textAlign: "center", position: "relative", zIndex: 2 }}
            >
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "2px solid var(--danger)",
                  width: "120px",
                  height: "120px",
                  borderRadius: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                  boxShadow: "0 0 30px rgba(239, 68, 68, 0.1)",
                }}
              >
                <div style={{ color: "var(--danger)" }}>
                  <CloudIcon size={48} />
                </div>
              </div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>
                BoosterAi.me Servers
              </h3>
              <p
                style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}
              >
                Blind Storage
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= DETAILED EXPLANATION ================= */}
      <section
        style={{
          padding: "var(--space-20) var(--space-6)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "var(--space-12)",
            }}
          >
            {/* Upload Process */}
            <div
              className="animate-slide-up"
              style={{ animationDelay: "400ms" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    background: "var(--bg-primary)",
                    padding: "10px",
                    borderRadius: "12px",
                  }}
                >
                  <div
                    style={{
                      color: "var(--accent-primary)",
                      fontWeight: "bold",
                    }}
                  >
                    01
                  </div>
                </div>
                <h2 style={{ fontSize: "1.75rem" }}>When You Upload</h2>
              </div>
              <p
                style={{
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  marginBottom: "24px",
                }}
              >
                You select a photo. Your browser encrypts it using{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  XChaCha20-Poly1305
                </strong>
                . This scrambles the data and ensures no one has tampered with
                it.
              </p>
              <div
                style={{
                  background: "var(--bg-elevated)",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid var(--border-primary)",
                }}
              >
                <div
                  style={{ display: "flex", gap: "12px", marginBottom: "12px" }}
                >
                  <div style={{ color: "var(--accent-primary)" }}>
                    <KeyIcon size={24} />
                  </div>
                  <h4 style={{ fontSize: "1rem", fontWeight: 600 }}>The Key</h4>
                </div>
                <p
                  style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}
                >
                  The encryption key comes from your password. Your password{" "}
                  <strong>never</strong> leaves your device. We do not see it or
                  store it.
                </p>
              </div>
            </div>

            {/* View Process */}
            <div
              className="animate-slide-up"
              style={{ animationDelay: "500ms" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    background: "var(--bg-primary)",
                    padding: "10px",
                    borderRadius: "12px",
                  }}
                >
                  <div style={{ color: "var(--success)", fontWeight: "bold" }}>
                    02
                  </div>
                </div>
                <h2 style={{ fontSize: "1.75rem" }}>When You View</h2>
              </div>
              <p
                style={{
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  marginBottom: "24px",
                }}
              >
                Your browser downloads the encrypted blob. It uses your password
                to derive the same key and decrypt the file locally in memory.
              </p>
              <div
                style={{
                  background: "var(--bg-elevated)",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid var(--border-primary)",
                }}
              >
                <div
                  style={{ display: "flex", gap: "12px", marginBottom: "12px" }}
                >
                  <div style={{ color: "var(--success)" }}>
                    <EyeOffIcon size={24} />
                  </div>
                  <h4 style={{ fontSize: "1rem", fontWeight: 600 }}>
                    Ephemeral Access
                  </h4>
                </div>
                <p
                  style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}
                >
                  The readable photo exists only in your device's RAM. It is not
                  written to your disk unencrypted. When you close the tab, it's
                  gone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRANSPARENCY / WHAT WE STORE ================= */}
      <section style={{ padding: "var(--space-20) var(--space-6)" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h2
            className="animate-slide-up"
            style={{
              fontSize: "2.5rem",
              textAlign: "center",
              marginBottom: "var(--space-12)",
            }}
          >
            Full Transparency
          </h2>

          <div
            className="animate-slide-up"
            style={{
              background: "var(--bg-elevated)",
              borderRadius: "24px",
              border: "1px solid var(--border-primary)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "24px",
                borderBottom: "1px solid var(--border-primary)",
                background: "var(--bg-secondary)",
              }}
            >
              <h3
                style={{
                  fontSize: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <CloudIcon size={20} />
                What We Store
              </h3>
            </div>

            <div style={{ padding: "32px" }}>
              <div style={{ marginBottom: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "8px",
                    color: "var(--danger)",
                  }}
                >
                  <ShieldIcon size={20} />
                  <span style={{ fontWeight: 600 }}>Encrypted Blobs</span>
                </div>
                <p
                  style={{ color: "var(--text-secondary)", marginLeft: "32px" }}
                >
                  The actual file content (pixels of your photos) is
                  mathematically indistinguishable from random noise to us.
                </p>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "8px",
                    color: "var(--text-primary)",
                  }}
                >
                  <SearchIcon size={20} />
                  <span style={{ fontWeight: 600 }}>
                    Effectively Private Metadata
                  </span>
                </div>
                <p
                  style={{ color: "var(--text-secondary)", marginLeft: "32px" }}
                >
                  We store filenames, album names, and dates to allow search
                  functionality.
                  <br />
                  <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                    *Note: We are working on encrypted search for v2.
                  </span>
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "24px",
                borderTop: "1px solid var(--border-primary)",
                background: "rgba(239, 68, 68, 0.05)",
              }}
            >
              <h3
                style={{
                  fontSize: "1rem",
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontWeight: 600,
                }}
              >
                <EyeOffIcon size={18} />
                What We Never See
              </h3>
              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  gap: "24px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.9rem",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--danger)",
                    }}
                  />
                  Your Password
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.9rem",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--danger)",
                    }}
                  />
                  Your Decryption Keys
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.9rem",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--danger)",
                    }}
                  />
                  Unencrypted Thumbnails
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section
        style={{
          padding: "0 var(--space-6) var(--space-24)",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "2rem", marginBottom: "var(--space-8)" }}>
          Ready for real privacy?
        </h2>
        <Link
          to="/register"
          className="btn btn-primary"
          style={{
            padding: "16px 40px",
            fontSize: "1.25rem",
            borderRadius: "var(--radius-full)",
          }}
        >
          Start Free Trial
        </Link>
      </section>

      <MarketingFooter />

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          opacity: 0;
        }
        @media (max-width: 768px) {
          .process-flow { flex-direction: column; gap: var(--space-12); }
          .flow-step { width: 100%; }
        }
      `}</style>
    </div>
  );
};
