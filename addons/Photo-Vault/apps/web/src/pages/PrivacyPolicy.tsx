import { MarketingHeader } from "../components/MarketingHeader";
import { MarketingFooter } from "../components/MarketingFooter";
import {
  ShieldIcon,
  EyeOffIcon,
  CheckIcon,
  SearchIcon,
  CloudIcon,
} from "../components/icons";

const PolicySection = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div
    style={{
      marginBottom: "var(--space-10)",
      padding: "var(--space-8)",
      borderRadius: "var(--radius-xl)",
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-primary)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "var(--space-6)",
      }}
    >
      <div style={{ color: "var(--accent-primary)" }}>{icon}</div>
      <h3 style={{ fontSize: "1.5rem", fontWeight: 600 }}>{title}</h3>
    </div>
    <div
      style={{
        color: "var(--text-secondary)",
        lineHeight: 1.7,
        fontSize: "1.05rem",
      }}
    >
      {children}
    </div>
  </div>
);

export const PrivacyPolicy = () => {
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
          padding: "var(--space-20) var(--space-6) var(--space-12)",
          textAlign: "center",
          background:
            "linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
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
            <ShieldIcon size={16} /> Legal & Privacy
          </div>

          <h1
            className="animate-slide-up"
            style={{
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: "var(--space-6)",
              animationDelay: "100ms",
            }}
          >
            Privacy Policy
          </h1>

          <p
            className="animate-slide-up"
            style={{
              fontSize: "1.25rem",
              color: "var(--text-secondary)",
              marginBottom: "var(--space-4)",
              maxWidth: "600px",
              margin: "0 auto var(--space-4)",
              lineHeight: 1.6,
              animationDelay: "200ms",
            }}
          >
            We cannot see your photos. Here is what we do know.
          </p>
          <p
            className="animate-slide-up"
            style={{
              fontSize: "0.9rem",
              color: "var(--text-tertiary)",
              animationDelay: "200ms",
            }}
          >
            Last Updated: February 2026
          </p>
        </div>
      </section>

      {/* ================= POLICY CONTENT ================= */}
      <section style={{ padding: "0 var(--space-6) var(--space-20)" }}>
        <div
          className="animate-slide-up"
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            animationDelay: "300ms",
          }}
        >
          {/* What We Cannot See */}
          <PolicySection
            title="What We Cannot See"
            icon={
              <div style={{ color: "var(--danger)" }}>
                <EyeOffIcon size={24} />
              </div>
            }
          >
            <ul style={{ listStyle: "none", padding: 0 }}>
              {[
                "We cannot see your photos or videos. Encrypted locally.",
                "We cannot see your encryption keys. They stay on your device.",
                "We cannot decrypt your files. No backdoors.",
                "This is technically enforced, not just a policy.",
              ].map((item, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "16px",
                    color: "var(--text-primary)",
                  }}
                >
                  <span style={{ color: "var(--danger)", display: "flex" }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
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
          </PolicySection>

          {/* Data Collection */}
          <PolicySection
            title="What We Collect"
            icon={
              <div style={{ color: "var(--success)" }}>
                <CheckIcon size={24} />
              </div>
            }
          >
            <div style={{ marginBottom: "24px" }}>
              <h4
                style={{
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                  fontSize: "1.1rem",
                }}
              >
                Account Information
              </h4>
              <p>
                We collect your email address for account management and
                critical service updates. We process payments via Stripe/Crypto
                providers but never store full credit card numbers.
              </p>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <h4
                style={{
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                  fontSize: "1.1rem",
                }}
              >
                Hashed Passwords
              </h4>
              <p>
                We store a salted hash of your password using Argon2id. We can
                verify it, but we cannot mathematically reverse it to see your
                actual password.
              </p>
            </div>

            <div>
              <h4
                style={{
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                  fontSize: "1.1rem",
                }}
              >
                User-Provided Metadata
              </h4>
              <p>
                Filenames, album names, dates, and notes you explicitly add are
                stored in plaintext to enable search functionality. You control
                this metadata.
              </p>
            </div>
          </PolicySection>

          {/* Usage & Analytics */}
          <PolicySection
            title="Usage & Analytics"
            icon={<SearchIcon size={24} />}
          >
            <p style={{ marginBottom: "16px" }}>
              We log basic operational metrics: login timestamps, storage usage
              quota, and API error rates.
            </p>
            <p>
              <strong>We do NOT track you across the web.</strong> No Google
              Analytics. No Facebook Pixels. No third-party ad trackers. All
              logging is internal and used strictly for maintaining service
              health.
            </p>
          </PolicySection>

          {/* Data Retention */}
          <PolicySection title="Data Retention" icon={<CloudIcon size={24} />}>
            <p style={{ marginBottom: "16px" }}>
              Your data remains in your vault until you delete it or your
              account expires.
            </p>
            <p>
              If you delete your account, we cryptographically erase your data.
              Because we only hold encrypted blobs, "deleting" the master key
              references makes the data permanently unrecoverable, even from
              backups.
            </p>
          </PolicySection>
        </div>
      </section>

      {/* ================= SIMPLIFIED SUMMARY ================= */}
      <section
        style={{
          padding: "var(--space-20) var(--space-6)",
          background: "var(--bg-secondary)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "2rem", marginBottom: "var(--space-6)" }}>
            In Plain English
          </h2>
          <p
            style={{
              fontSize: "1.25rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            "You hold the keys. We simply store the locked box. We don't know
            what's inside, and we can't open it for anyone."
          </p>
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
};
