import { MarketingHeader } from "../components/MarketingHeader";
import { MarketingFooter } from "../components/MarketingFooter";
import {
  FileCodeIcon,
  CloudIcon,
  KeyIcon,
  CheckIcon,
  ShieldIcon,
  CreditCardIcon,
  LockIcon,
} from "../components/icons";

const TermsSection = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
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
      {icon && <div style={{ color: "var(--accent-primary)" }}>{icon}</div>}
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

export const TermsOfService = () => {
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
            <FileCodeIcon size={16} /> Legal
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
            Terms of Service
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
            The rules for using BoosterAi.me. Plain English, no legalese.
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

      {/* ================= TERMS CONTENT ================= */}
      <section style={{ padding: "0 var(--space-6) var(--space-20)" }}>
        <div
          className="animate-slide-up"
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            animationDelay: "300ms",
          }}
        >
          {/* Agreement */}
          <TermsSection title="Agreement" icon={<FileCodeIcon size={24} />}>
            <p style={{ marginBottom: "16px" }}>
              By using BoosterAi.me, you agree to these terms. If you do not
              agree, do not use the service. It is that simple.
            </p>
            <p>
              These terms are a contract between you and us. They are legally
              binding.
            </p>
          </TermsSection>

          {/* What BoosterAi.me Is */}
          <TermsSection
            title="What BoosterAi.me Is"
            icon={<CloudIcon size={24} />}
          >
            <p style={{ marginBottom: "16px" }}>
              BoosterAi.me is a secure photo and video storage service.
            </p>
            <p style={{ marginBottom: "16px" }}>
              All your files are encrypted on your device before upload. We
              store encrypted files we cannot read. This is called
              zero-knowledge encryption.
            </p>
            <p>
              We provide storage, organization tools, and export features. We do
              not provide image editing, printing, or photo sharing with other
              users.
            </p>
          </TermsSection>

          {/* Your Account */}
          <TermsSection title="Your Account" icon={<KeyIcon size={24} />}>
            <p style={{ marginBottom: "16px" }}>
              You need an account to use BoosterAi.me. You must provide a valid
              email address and create a password.
            </p>
            <p style={{ marginBottom: "16px" }}>
              <strong>
                You are responsible for keeping your password secret.
              </strong>
            </p>
            <p>
              We cannot reset your password or recover your encrypted files if
              you lose your password. This is by design. Zero-knowledge
              encryption means we cannot help you if you forget your password.
            </p>
          </TermsSection>

          {/* Dos & Don'ts Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "var(--space-8)",
              marginBottom: "var(--space-10)",
            }}
          >
            {/* What You Can Do */}
            <div
              style={{
                padding: "var(--space-8)",
                borderRadius: "var(--radius-xl)",
                background: "rgba(0, 255, 148, 0.05)",
                border: "1px solid rgba(0, 255, 148, 0.2)",
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
                <div style={{ color: "var(--success)" }}>
                  <CheckIcon size={24} />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  What You Can Do
                </h3>
              </div>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {[
                  "Upload photos/videos",
                  "Organize into albums",
                  "Search your vault",
                  "Export your data",
                  "Delete your account",
                ].map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "8px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--success)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
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
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* What You Cannot Do */}
            <div
              style={{
                padding: "var(--space-8)",
                borderRadius: "var(--radius-xl)",
                background: "rgba(255, 76, 76, 0.05)",
                border: "1px solid rgba(255, 76, 76, 0.2)",
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
                <div style={{ color: "var(--danger)" }}>
                  <ShieldIcon size={24} />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  What You Cannot Do
                </h3>
              </div>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {[
                  "Store illegal content",
                  "Upload viruses/malware",
                  "Attempt to hack us",
                  "Abuse/Spam the service",
                ].map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "8px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--danger)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
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
            </div>
          </div>

          {/* Free Trial */}
          <TermsSection title="Free Trial">
            <p style={{ marginBottom: "16px" }}>
              New users get a free trial. 14 days. 50 photos or videos.
            </p>
            <p>
              No credit card required. You can cancel anytime during the trial.
              After the trial ends, you must subscribe to continue using the
              service. If you do not subscribe, your account becomes read-only.
            </p>
          </TermsSection>

          {/* Subscriptions */}
          <TermsSection
            title="Subscriptions & Billing"
            icon={
              <div style={{ color: "var(--accent-secondary)" }}>
                <CreditCardIcon size={24} />
              </div>
            }
          >
            <ul
              style={{
                paddingLeft: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <li>
                <strong>Prepaid:</strong> Subscriptions are billed in advance at
                the start of each period.
              </li>
              <li>
                <strong>Refunds:</strong> Non-refundable except during the first
                30 days. If you are unhappy within 30 days, email us.
              </li>
              <li>
                <strong>Cancellation:</strong> You can cancel anytime. You keep
                access until your current billing period ends.
              </li>
              <li>
                <strong>No Auto-Renew:</strong> We do not auto-renew. You must
                manually renew. We will remind you.
              </li>
            </ul>
          </TermsSection>

          {/* Stop Paying */}
          <TermsSection
            title="If You Stop Paying"
            icon={<LockIcon size={24} />}
          >
            <p>
              If your subscription expires, your account becomes{" "}
              <strong>read-only</strong>.
            </p>
            <p style={{ marginTop: "10px" }}>
              You can log in, view your files, and export your data. You simply
              cannot upload new files until you renew.
            </p>
          </TermsSection>
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
