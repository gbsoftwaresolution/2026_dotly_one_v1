import React from "react";
import { Link } from "react-router-dom";

export const MarketingFooter: React.FC = () => {
  return (
    <footer
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderTop: "1px solid var(--border-primary)",
        marginTop: "var(--space-24)",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "var(--space-20) var(--space-6) var(--space-12)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-16)",
            marginBottom: "var(--space-16)",
          }}
        >
          {/* Brand Column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-6)",
            }}
          >
            <Link to="/" style={{ textDecoration: "none" }}>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 900,
                  background:
                    "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{ color: "var(--accent-primary)", display: "flex" }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </span>
                BoosterAi.me
              </div>
            </Link>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.95rem",
                lineHeight: 1.6,
                maxWidth: "300px",
              }}
            >
              The secure, zero-knowledge photo vault for your most private
              memories. Your data, your keys.
            </p>

            {/* Status Indicator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.85rem",
                color: "var(--text-tertiary)",
                marginTop: "var(--space-2)",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "var(--success)",
                  boxShadow: "0 0 8px var(--success)",
                }}
              />
              All Systems Operational
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h4
              style={{
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "var(--space-6)",
              }}
            >
              Product
            </h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              <Link to="/pricing" className="footer-link">
                Pricing
              </Link>
              <Link to="/how-encryption-works" className="footer-link">
                Security Architecture
              </Link>
              <Link to="/export-your-data" className="footer-link">
                Data Export
              </Link>
              <Link to="/faq" className="footer-link">
                FAQ
              </Link>
            </div>
          </div>

          {/* Legal Column */}
          <div>
            <h4
              style={{
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "var(--space-6)",
              }}
            >
              Legal
            </h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              <Link to="/privacy-policy" className="footer-link">
                Privacy Policy
              </Link>
              <Link to="/terms" className="footer-link">
                Terms of Service
              </Link>
            </div>
          </div>

          {/* Stay Updated / Newsletter */}
          <div>
            <h4
              style={{
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "var(--space-6)",
              }}
            >
              Stay Updated
            </h4>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
                marginBottom: "var(--space-4)",
              }}
            >
              Get the latest security updates and features.
            </p>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <input
                type="email"
                placeholder="Enter your email"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  color: "var(--text-primary)",
                  flex: 1,
                  fontSize: "0.9rem",
                }}
              />
              <button className="btn btn-sm btn-secondary">Join</button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            paddingTop: "var(--space-8)",
            borderTop: "1px solid var(--border-primary)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-4)",
          }}
        >
          <p
            style={{
              color: "var(--text-tertiary)",
              fontSize: "0.875rem",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            © {new Date().getFullYear()} BoosterAi.me. Built with{" "}
            <span
              style={{
                color: "var(--danger)",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </span>{" "}
            and 0x00.
          </p>

          <div style={{ display: "flex", gap: "var(--space-4)" }}>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-link"
              style={{ display: "flex", alignItems: "center" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
              </svg>
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-link"
            >
              GitHub
            </a>
            <a
              href="mailto:support@boostervault.com"
              className="footer-social-link"
            >
              Email
            </a>
          </div>
        </div>
      </div>

      <style>{`
        .footer-link {
          color: var(--text-secondary);
          font-size: 0.95rem;
          transition: color 0.2s ease, transform 0.2s ease;
          text-decoration: none;
          display: inline-block;
        }
        .footer-link:hover {
          color: var(--accent-primary);
          transform: translateX(4px);
        }
        .footer-social-link {
          color: var(--text-tertiary);
          font-size: 0.9rem;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .footer-social-link:hover {
          color: var(--text-primary);
        }
      `}</style>
    </footer>
  );
};
