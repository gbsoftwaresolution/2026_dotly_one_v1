import { Link } from "react-router-dom";
import { MarketingHeader } from "../components/MarketingHeader";
import { MarketingFooter } from "../components/MarketingFooter";
import {
  CheckIcon,
  ShieldIcon,
  FolderIcon,
  DownloadIcon,
  CameraIcon,
  SearchIcon,
  EyeOffIcon,
  CreditCardIcon,
} from "../components/icons";

export default function Pricing() {
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
          padding: "var(--space-20) var(--space-6) var(--space-10)",
          textAlign: "center",
          backgroundImage: `
          radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.1) 0%, transparent 40%)
        `,
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h1
            className="animate-slide-up"
            style={{
              fontSize: "clamp(3rem, 6vw, 4.5rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: "var(--space-6)",
              letterSpacing: "-0.03em",
            }}
          >
            Simple pricing.
            <br />
            <span
              style={{
                color: "transparent",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                backgroundImage:
                  "linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)",
              }}
            >
              No hidden fees.
            </span>
          </h1>
          <p
            className="animate-slide-up"
            style={{
              fontSize: "1.25rem",
              color: "var(--text-secondary)",
              marginBottom: "var(--space-12)",
              maxWidth: "600px",
              marginLeft: "auto",
              marginRight: "auto",
              animationDelay: "100ms",
              lineHeight: 1.6,
            }}
          >
            Pay once for a period of service. No recurring charges unless you
            renew. Pay with crypto or a credit card. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ================= PRICING PLANS ================= */}
      <section style={{ padding: "0 var(--space-6) var(--space-20)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Free Trial Banner */}
          <div
            className="animate-slide-up"
            style={{
              animationDelay: "200ms",
              background:
                "linear-gradient(90deg, rgba(0, 212, 255, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)",
              border: "1px solid var(--accent-primary)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-8)",
              marginBottom: "var(--space-12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--space-6)",
            }}
          >
            <div>
              <h3
                style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}
              >
                Start with a Free Trial
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>
                14 days. 50 photos. Full encryption. No credit card required.
              </p>
            </div>
            <Link
              to="/register"
              className="btn btn-primary"
              style={{
                borderRadius: "var(--radius-full)",
                padding: "12px 28px",
                fontSize: "1rem",
                whiteSpace: "nowrap",
              }}
            >
              Start Free Trial
            </Link>
          </div>

          {/* Pricing Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "var(--space-8)",
            }}
          >
            {/* 6 Months Plan */}
            <div
              className="animate-slide-up"
              style={{
                animationDelay: "300ms",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-10)",
                position: "relative",
                transition: "transform 0.2s ease",
              }}
            >
              <h3
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "1.25rem",
                  marginBottom: "var(--space-4)",
                }}
              >
                6 Months
              </h3>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  marginBottom: "var(--space-6)",
                }}
              >
                <span style={{ fontSize: "3rem", fontWeight: 800 }}>$25</span>
                <span
                  style={{ color: "var(--text-tertiary)", marginLeft: "8px" }}
                >
                  / period
                </span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  marginBottom: "var(--space-8)",
                  padding: 0,
                }}
              >
                {[
                  "Access for 6 months",
                  "Unlimited storage",
                  "All features included",
                  "Client-side encryption",
                ].map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "12px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <CheckIcon size={18} /> {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="btn btn-secondary"
                style={{ width: "100%", borderRadius: "var(--radius-lg)" }}
              >
                Get Started
              </Link>
            </div>

            {/* 1 Year Basic */}
            <div
              className="animate-slide-up"
              style={{
                animationDelay: "400ms",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-10)",
                position: "relative",
              }}
            >
              <h3
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "1.25rem",
                  marginBottom: "var(--space-4)",
                }}
              >
                1 Year (Basic)
              </h3>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  marginBottom: "var(--space-6)",
                }}
              >
                <span style={{ fontSize: "3rem", fontWeight: 800 }}>$100</span>
                <span
                  style={{ color: "var(--text-tertiary)", marginLeft: "8px" }}
                >
                  / year
                </span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  marginBottom: "var(--space-8)",
                  padding: 0,
                }}
              >
                {[
                  "Access for 1 year",
                  "Unlimited storage",
                  "All features included",
                  "Client-side encryption",
                ].map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "12px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <CheckIcon size={18} /> {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="btn btn-secondary"
                style={{ width: "100%", borderRadius: "var(--radius-lg)" }}
              >
                Get Started
              </Link>
            </div>

            {/* 1 Year Premium (Featured) */}
            <div
              className="animate-slide-up"
              style={{
                animationDelay: "500ms",
                background:
                  "linear-gradient(145deg, var(--bg-elevated) 0%, rgba(124, 58, 237, 0.05) 100%)",
                border: "1px solid var(--accent-primary)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-10)",
                position: "relative",
                boxShadow: "0 20px 40px -10px rgba(124, 58, 237, 0.15)",
                transform: "scale(1.02)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--accent-primary)",
                  color: "white",
                  padding: "4px 12px",
                  borderRadius: "999px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
              >
                RECOMMENDED
              </div>
              <h3
                style={{
                  color: "var(--accent-primary)",
                  fontSize: "1.25rem",
                  marginBottom: "var(--space-4)",
                }}
              >
                1 Year (Premium)
              </h3>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  marginBottom: "var(--space-6)",
                }}
              >
                <span style={{ fontSize: "3rem", fontWeight: 800 }}>$199</span>
                <span
                  style={{ color: "var(--text-tertiary)", marginLeft: "8px" }}
                >
                  / year
                </span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  marginBottom: "var(--space-8)",
                  padding: 0,
                }}
              >
                {[
                  "Access for 1 year",
                  "Unlimited storage",
                  "Priority Support",
                  "Early access to features",
                  "Everything in Basic",
                ].map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "12px",
                      color: "var(--text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    <div style={{ color: "var(--accent-primary)" }}>
                      <CheckIcon size={18} />
                    </div>{" "}
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="btn btn-primary"
                style={{
                  width: "100%",
                  borderRadius: "var(--radius-lg)",
                  padding: "14px",
                }}
              >
                Go Premium
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURES GRID ================= */}
      <section
        style={{
          padding: "var(--space-20) var(--space-6)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "var(--space-16)" }}>
            <h2 style={{ fontSize: "2.5rem", marginBottom: "var(--space-4)" }}>
              Included in Every Plan
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "1.125rem" }}>
              We don't gate privacy behind a paywall.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "var(--space-12) var(--space-8)",
            }}
          >
            {[
              {
                icon: FolderIcon,
                title: "Unlimited Storage",
                desc: "Upload as many photos and videos as you want. No caps.",
              },
              {
                icon: ShieldIcon,
                title: "Client-Side Encryption",
                desc: "True zero-knowledge. Encrypted before it leaves your device.",
              },
              {
                icon: CameraIcon,
                title: "Timeline View",
                desc: "Organize memories chronologically with a beautiful interface.",
              },
              {
                icon: SearchIcon,
                title: "Private Search",
                desc: "Find photos without us scanning them. Metadata search is local.",
              },
              {
                icon: DownloadIcon,
                title: "Data Export",
                desc: "Download all your encrypted data anytime as a standard ZIP.",
              },
              {
                icon: EyeOffIcon,
                title: "No Tracking",
                desc: "No ads. No behavior analysis. No selling your data.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="animate-slide-up"
                style={{
                  animationDelay: `${600 + i * 50}ms`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    color: "var(--accent-primary)",
                    background: "var(--bg-primary)",
                    padding: "16px",
                    borderRadius: "16px",
                    marginBottom: "16px",
                    border: "1px solid var(--border-primary)",
                  }}
                >
                  <feature.icon size={32} />
                </div>
                <h4 style={{ fontSize: "1.25rem", marginBottom: "8px" }}>
                  {feature.title}
                </h4>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.95rem",
                    lineHeight: 1.5,
                  }}
                >
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PAYMENT METHODS ================= */}
      <section
        style={{
          padding: "var(--space-20) var(--space-6)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h3
            style={{
              fontSize: "1.5rem",
              color: "var(--text-tertiary)",
              marginBottom: "var(--space-8)",
            }}
          >
            Worry-free payments
          </h3>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "var(--space-12)",
              flexWrap: "wrap",
              alignItems: "center",
              opacity: 0.7,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CreditCardIcon size={32} />
              <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                Credit Card
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-7.37.982-.361 2.224-2.224 1.216-4.924-1.29-3.45-6.14-2.888-8.29-2.02l.605-2.775-2.016-.446-.605 2.774a38.47 38.47 0 0 0-2.823.593l.363-1.666-2.016-.445-.605 2.774a38.47 38.47 0 0 0-2.823.593l.445-2.016-2.016-.445-.445 2.016a42.92 42.92 0 0 0-2.673.702l.445 2.016-2.016 2.016 2.016 2.016-.445 2.016 2.016.445.445-2.016a42.92 42.92 0 0 0 2.673-.702l-.445-2.016 2.016-.445.445 2.016 2.016.445.445 2.016 2.016.445z" />
              </svg>
              <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                Crypto Accepted
              </span>
            </div>
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
