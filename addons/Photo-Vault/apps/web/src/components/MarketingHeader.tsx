import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldIcon } from "./icons";

export const MarketingHeader: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: isScrolled
          ? "rgba(5, 5, 5, 0.85)"
          : "rgba(5, 5, 5, 0.5)",
        backdropFilter: "blur(12px)",
        borderBottom: isScrolled
          ? "1px solid var(--border-primary)"
          : "1px solid transparent",
        transition: "all 0.3s ease",
      }}
    >
      <nav
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "var(--space-4) var(--space-6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link to="/" style={{ textDecoration: "none" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "1.5rem",
              fontWeight: 900,
              background:
                "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.02em",
            }}
          >
            <div style={{ color: "var(--accent-primary)" }}>
              <ShieldIcon size={32} />
            </div>
            BoosterAi.me
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-8)",
          }}
          className="desktop-nav"
        >
          <Link
            to="/pricing"
            style={{
              color: "var(--text-secondary)",
              fontWeight: 500,
              fontSize: "0.9375rem",
              transition: "color var(--transition-fast)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
          >
            Pricing
          </Link>

          <Link
            to="/how-encryption-works"
            style={{
              color: "var(--text-secondary)",
              fontWeight: 500,
              fontSize: "0.9375rem",
              transition: "color var(--transition-fast)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
          >
            Security
          </Link>

          <Link
            to="/faq"
            style={{
              color: "var(--text-secondary)",
              fontWeight: 500,
              fontSize: "0.9375rem",
              transition: "color var(--transition-fast)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
          >
            FAQ
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginLeft: "var(--space-4)",
            }}
          >
            <Link to="/login" className="btn btn-ghost btn-sm">
              Login
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              Start Free Trial
            </Link>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="btn btn-ghost btn-sm mobile-menu-btn"
          style={{ display: "none" }}
        >
          {mobileMenuOpen ? (
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
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
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-primary)",
            padding: "var(--space-6)",
          }}
          className="mobile-menu"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <Link
              to="/pricing"
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              Pricing
            </Link>
            <Link
              to="/how-encryption-works"
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              Security
            </Link>
            <Link
              to="/faq"
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              FAQ
            </Link>
            <div
              style={{
                height: "1px",
                backgroundColor: "var(--border-primary)",
                margin: "var(--space-2) 0",
              }}
            />
            <Link
              to="/login"
              className="btn btn-secondary"
              style={{ width: "100%" }}
            >
              Login
            </Link>
            <Link
              to="/register"
              className="btn btn-primary"
              style={{ width: "100%" }}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
};
