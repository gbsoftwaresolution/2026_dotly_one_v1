import { Link } from "react-router-dom";
import { MarketingHeader } from "../components/MarketingHeader";
import { MarketingFooter } from "../components/MarketingFooter";
import {
  DownloadIcon,
  ShieldIcon,
  FolderIcon,
  FileCodeIcon,
  KeyIcon,
  CheckIcon,
} from "../components/icons";

export default function ExportYourData() {
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
            "radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.1) 0%, transparent 40%)",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div
            className="animate-slide-up"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--bg-elevated)",
              padding: "8px 16px",
              borderRadius: "999px",
              border: "1px solid var(--border-primary)",
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "var(--space-8)",
            }}
          >
            <DownloadIcon size={16} /> Data Portability Guarantee
          </div>

          <h1
            className="animate-slide-up"
            style={{
              fontSize: "clamp(3rem, 5vw, 4.5rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: "var(--space-6)",
              animationDelay: "100ms",
            }}
          >
            Your data belongs to you.
            <br />
            <span style={{ color: "var(--success)" }}>Take it anytime.</span>
          </h1>

          <p
            className="animate-slide-up"
            style={{
              fontSize: "1.25rem",
              color: "var(--text-secondary)",
              marginBottom: "var(--space-12)",
              maxWidth: "650px",
              margin: "0 auto var(--space-12)",
              lineHeight: 1.6,
              animationDelay: "200ms",
            }}
          >
            BoosterAi.me makes it easy to leave. Download your entire encrypted
            vault instantly. No fees. No waiting periods. No questions asked.
          </p>

          <div className="animate-slide-up" style={{ animationDelay: "300ms" }}>
            <Link
              to="/register"
              className="btn btn-primary"
              style={{
                padding: "16px 40px",
                fontSize: "1.1rem",
                borderRadius: "var(--radius-full)",
              }}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* ================= THE PROBLEM vs SOLUTION ================= */}
      <section style={{ padding: "0 var(--space-6) var(--space-24)" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "var(--space-10)",
              alignItems: "center",
            }}
          >
            {/* Industry Standard */}
            <div
              className="animate-slide-up"
              style={{ animationDelay: "400ms", opacity: 0.7 }}
            >
              <h3
                style={{
                  fontSize: "1.5rem",
                  marginBottom: "var(--space-6)",
                  color: "var(--text-tertiary)",
                }}
              >
                Cloud Industry Standard
              </h3>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {[
                  "Difficult to download all files at once",
                  "Proprietary formats",
                  "Data held hostage if payment fails",
                  'Slow "archive request" processing times',
                ].map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "16px",
                      color: "var(--text-disabled)",
                      fontSize: "1.1rem",
                    }}
                  >
                    <span style={{ color: "var(--danger)", display: "flex" }}>
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

            {/* BoosterAi.me Way */}
            <div
              className="animate-slide-up"
              style={{
                animationDelay: "500ms",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-primary)",
                borderRadius: "24px",
                padding: "40px",
                boxShadow: "0 20px 50px -10px rgba(0, 0, 0, 0.5)",
              }}
            >
              <h3
                style={{
                  fontSize: "1.5rem",
                  marginBottom: "var(--space-6)",
                  color: "var(--text-primary)",
                }}
              >
                The BoosterAi.me Way
              </h3>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {[
                  "One-click full export",
                  "Standard ZIP & JSON formats",
                  "Download even if subscription expires",
                  "Instant link generation",
                ].map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "16px",
                      color: "var(--text-primary)",
                      fontSize: "1.1rem",
                      fontWeight: 500,
                    }}
                  >
                    <span style={{ color: "var(--success)" }}>
                      <CheckIcon size={20} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================= WHAT'S INSIDE ================= */}
      <section
        style={{
          padding: "var(--space-20) var(--space-6)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "var(--space-16)" }}>
            <h2 style={{ fontSize: "2.5rem", marginBottom: "var(--space-4)" }}>
              What You Get
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>
              A total export of your digital life.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "var(--space-8)",
            }}
          >
            <div
              className="animate-slide-up"
              style={{
                animationDelay: "600ms",
                padding: "var(--space-8)",
                background: "var(--bg-primary)",
                borderRadius: "16px",
              }}
            >
              <div
                style={{ color: "var(--accent-primary)", marginBottom: "16px" }}
              >
                <ShieldIcon size={32} />
              </div>
              <h4 style={{ fontSize: "1.25rem", marginBottom: "8px" }}>
                Encrypted Media
              </h4>
              <p style={{ color: "var(--text-secondary)" }}>
                Your photos and videos in their original, encrypted state. You
                retain the only copy of the decryption key (your password).
              </p>
            </div>

            <div
              className="animate-slide-up"
              style={{
                animationDelay: "700ms",
                padding: "var(--space-8)",
                background: "var(--bg-primary)",
                borderRadius: "16px",
              }}
            >
              <div style={{ color: "var(--success)", marginBottom: "16px" }}>
                <FileCodeIcon size={32} />
              </div>
              <h4 style={{ fontSize: "1.25rem", marginBottom: "8px" }}>
                Metadata Manifest
              </h4>
              <p style={{ color: "var(--text-secondary)" }}>
                A <code>manifest.json</code> file detailing every item,
                containing timestamps, original filenames, and organization
                data.
              </p>
            </div>

            <div
              className="animate-slide-up"
              style={{
                animationDelay: "800ms",
                padding: "var(--space-8)",
                background: "var(--bg-primary)",
                borderRadius: "16px",
              }}
            >
              <div
                style={{ color: "var(--text-primary)", marginBottom: "16px" }}
              >
                <FolderIcon size={32} />
              </div>
              <h4 style={{ fontSize: "1.25rem", marginBottom: "8px" }}>
                Folder Structure
              </h4>
              <p style={{ color: "var(--text-secondary)" }}>
                Full album hierarchy preserved. We export your organization, not
                just a flat list of files.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TECHNICAL NOTE ================= */}
      <section style={{ padding: "var(--space-20) var(--space-6)" }}>
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            padding: "var(--space-10)",
            background: "rgba(124, 58, 237, 0.05)",
            borderRadius: "24px",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            display: "flex",
            gap: "var(--space-8)",
            alignItems: "flex-start",
          }}
        >
          <div style={{ color: "var(--accent-primary)", flexShrink: 0 }}>
            <KeyIcon size={32} />
          </div>
          <div>
            <h3
              style={{
                fontSize: "1.5rem",
                marginBottom: "var(--space-4)",
                color: "var(--accent-primary)",
              }}
            >
              Important Technical Note
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                marginBottom: "var(--space-4)",
              }}
            >
              Because we use Zero-Knowledge encryption,{" "}
              <strong>we cannot export unencrypted files</strong> for you. We
              literally cannot see them.
            </p>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              You will download the encrypted data, and use our open-source
              decryption tool (or the CLI) with your password to unlock them on
              your own machine.
            </p>
          </div>
        </div>
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
      `}</style>
    </div>
  );
}
