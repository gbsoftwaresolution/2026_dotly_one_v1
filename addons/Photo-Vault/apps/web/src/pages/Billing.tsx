import React, { useState, useEffect } from "react";
import { billingApi } from "../api/billing";
import { useSubscription } from "../hooks/useSubscription";
import type {
  BillingPlan,
  CryptoInvoiceResponse,
  CryptoInvoiceStatusResponse,
} from "../types/api";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/ToastProvider";

// --- Icons ---
const CheckIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const CreditCardIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
    <line x1="1" y1="10" x2="23" y2="10"></line>
  </svg>
);

const BitcoinIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11.767 19.089l1.455-5.698 3.535.903c.69.176 1.096.88 1.04 1.583-.075.92-.857 1.625-1.78 1.625h-4.25v1.587h-1.633v-1.587H8.567L7.112 22.9 5.5 22.488l1.455-5.698H5.5v-1.611h1.595l.434-1.7H5.5V11.87h2.09l.453-1.775 1.633.417-.453 1.775h1.965c2.502 0 4.312.435 5.094 2.809.349 1.06-.065 2.155-.918 2.76.853.535 1.341 1.498 1.25 2.49-.123 1.343-1.125 2.422-2.474 2.56l-3.328.85-1.633-.416.452-1.775h-1.633v1.587H5.967L4.512 22.9 2.9 22.488l1.455-5.698H2.9v-1.611h1.455l.89-3.483L4 11.232l1.357.347.534-2.09c1.077.275 1.722.999 1.545 1.693l-.504 1.972h2.463l.534-2.092 1.633.417-.534 2.092h1.666c1.171 0 1.996.697 1.905 1.693-.065.703-.47 1.407-1.16 1.583l-3.328.85-.504 1.972h2.72c1.171 0 1.996.697 1.905 1.693-.065.703-.47 1.407-1.16 1.583l-3.328.85-1.633-.417z" />
  </svg>
);

const CrownIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 4l3 12h14l3-12-6 7-4-3-4 3-6-7z"></path>
  </svg>
);

const CopyIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

export const Billing: React.FC = () => {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeInvoice, setActiveInvoice] =
    useState<CryptoInvoiceResponse | null>(null);
  const [invoiceStatus, setInvoiceStatus] =
    useState<CryptoInvoiceStatusResponse | null>(null);

  const subscription = useSubscription();
  const toast = useToast();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await billingApi.listPlans();
        // Sort plans by price
        setPlans(data.sort((a, b) => a.priceCents - b.priceCents));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  // Polling for active invoice status
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeInvoice) {
      // Poll immediately
      const checkStatus = async () => {
        try {
          const status = await billingApi.getCryptoInvoiceStatus(
            activeInvoice.invoiceId,
          );
          setInvoiceStatus(status);
          if (["PAID", "EXPIRED", "CANCELED"].includes(status.status)) {
            clearInterval(interval);
            if (status.status === "PAID") {
              // Refresh subscription after small delay
              setTimeout(() => subscription.refresh(), 2000);
            }
          }
        } catch (err) {
          console.error("Failed to poll invoice status", err);
        }
      };

      checkStatus();
      interval = setInterval(checkStatus, 5000);
    }
    return () => clearInterval(interval);
  }, [activeInvoice]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateCryptoInvoice = async (planCode: string) => {
    try {
      const inv = await billingApi.createCryptoInvoice(planCode);
      setActiveInvoice(inv);
      setInvoiceStatus(null);
      // Close the selection modal if we had one (conceptually)
    } catch (err: any) {
      toast.danger(
        "Invoice failed",
        err?.message
          ? `Failed to create invoice: ${err.message}`
          : "Failed to create invoice",
      );
    }
  };

  const handleStripeCheckout = async (planCode: string) => {
    try {
      const session = await billingApi.createStripeCheckoutSession(planCode);
      window.location.href = session.checkoutUrl;
    } catch (err: any) {
      toast.danger(
        "Checkout failed",
        err?.message
          ? `Failed to start checkout: ${err.message}`
          : "Failed to start checkout",
      );
    }
  };

  if (loading || subscription.isLoading)
    return <Loading message="Loading billing plans..." />;
  if (error)
    return (
      <ErrorState message={error} onRetry={() => window.location.reload()} />
    );

  return (
    <div
      style={{
        paddingBottom: "4rem",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Sticky Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "rgba(10, 10, 10, 0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-primary)",
          margin: "0 -2rem",
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            Subscription
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "var(--text-tertiary)",
            }}
          >
            Manage your plan and billing details
          </p>
        </div>
        {subscription.isTrial && (
          <div
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: "99px",
              color: "#60a5fa",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Trial: {subscription.trialDaysRemaining} days left
          </div>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          paddingTop: "2rem",
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Active Invoice Alert */}
        {activeInvoice && invoiceStatus?.status !== "PAID" && (
          <div
            style={{
              marginBottom: "2rem",
              padding: "1.5rem",
              backgroundColor: "rgba(234, 179, 8, 0.1)",
              border: "1px solid rgba(234, 179, 8, 0.2)",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              animation: "slideDown 0.3s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{ display: "flex", gap: "1rem", alignItems: "center" }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(234, 179, 8, 0.2)",
                    color: "#eab308",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BitcoinIcon />
                </div>
                <div>
                  <h3
                    style={{ margin: 0, color: "#fef08a", fontSize: "1.1rem" }}
                  >
                    Pending Crypto Payment
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--text-secondary)",
                      fontSize: "0.9rem",
                    }}
                  >
                    Please complete the payment to activate your plan.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveInvoice(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  fontSize: "1.5rem",
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <div
              style={{
                backgroundColor: "rgba(0,0,0,0.3)",
                padding: "1rem",
                borderRadius: "8px",
                fontFamily: "monospace",
                display: "grid",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-tertiary)" }}>Amount:</span>
                <span
                  style={{ color: "var(--text-primary)", fontWeight: "bold" }}
                >
                  {activeInvoice.amountCents / 100} {activeInvoice.currency}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "var(--text-tertiary)" }}>Address:</span>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      color: "var(--accent-primary)",
                      wordBreak: "break-all",
                    }}
                  >
                    {activeInvoice.paymentAddress}
                  </span>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        activeInvoice.paymentAddress,
                      )
                    }
                    title="Copy Address"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <CopyIcon />
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-tertiary)" }}>Status:</span>
                <span
                  style={{
                    color:
                      (invoiceStatus?.status as string) === "PAID"
                        ? "var(--accent-primary)"
                        : "#eab308",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {invoiceStatus?.status || "WAITING..."}
                  {invoiceStatus?.status === "PENDING" && (
                    <span className="spinner" />
                  )}
                </span>
              </div>
            </div>
            <style>{`
                        .spinner {
                            width: 12px; height: 12px;
                            border: 2px solid currentColor;
                            border-right-color: transparent;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                        }
                        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                    `}</style>
          </div>
        )}

        {/* Plans Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "2rem",
            alignItems: "stretch",
          }}
        >
          {plans.map((plan) => {
            const isCurrent =
              plan.code === subscription.subscription?.currentPlanCode;
            return (
              <div
                key={plan.code}
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  border: `1px solid ${isCurrent ? "var(--accent-primary)" : "var(--border-primary)"}`,
                  borderRadius: "24px",
                  padding: "2rem",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  boxShadow: isCurrent
                    ? "0 0 30px rgba(74, 222, 128, 0.1)"
                    : "none",
                  transition: "transform 0.2s",
                  opacity: activeInvoice && !isCurrent ? 0.5 : 1,
                  pointerEvents: activeInvoice && !isCurrent ? "none" : "auto",
                }}
              >
                {isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-12px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      backgroundColor: "var(--accent-primary)",
                      color: "#000",
                      padding: "0.25rem 1rem",
                      borderRadius: "99px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Current Plan
                  </div>
                )}

                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem" }}>
                    {plan.name}
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "2.5rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      ${(plan.priceCents / 100).toFixed(0)}
                    </span>
                    <span
                      style={{
                        color: "var(--text-tertiary)",
                        fontSize: "1rem",
                      }}
                    >
                      / {plan.interval}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, marginBottom: "2rem" }}>
                  {plan.features.map((feature, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        marginBottom: "1rem",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          color: "var(--accent-primary)",
                          marginTop: "2px",
                        }}
                      >
                        <CheckIcon />
                      </div>
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "0.95rem",
                          lineHeight: "1.5",
                        }}
                      >
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  {isCurrent ? (
                    <button
                      disabled
                      style={{
                        width: "100%",
                        padding: "0.875rem",
                        borderRadius: "12px",
                        border: "1px solid var(--border-primary)",
                        backgroundColor: "rgba(255,255,255,0.05)",
                        color: "var(--text-tertiary)",
                        fontWeight: 600,
                        cursor: "default",
                      }}
                    >
                      Active
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStripeCheckout(plan.code)}
                        style={{
                          width: "100%",
                          padding: "0.875rem",
                          borderRadius: "12px",
                          border: "none",
                          backgroundColor: "var(--text-primary)",
                          color: "var(--bg-primary)",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          transition: "opacity 0.2s",
                        }}
                      >
                        <CreditCardIcon />
                        Credit Card
                      </button>
                      <button
                        onClick={() => handleCreateCryptoInvoice(plan.code)}
                        style={{
                          width: "100%",
                          padding: "0.875rem",
                          borderRadius: "12px",
                          border: "1px solid var(--border-primary)",
                          backgroundColor: "transparent",
                          color: "var(--text-primary)",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          transition: "background-color 0.2s",
                        }}
                      >
                        <BitcoinIcon />
                        Crypto
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ / Info Section */}
        <div
          style={{
            marginTop: "4rem",
            borderTop: "1px solid var(--border-primary)",
            paddingTop: "3rem",
          }}
        >
          <h3
            style={{
              fontSize: "1.25rem",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <CrownIcon />
            Why Upgrade?
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "2rem",
            }}
          >
            <div>
              <h4
                style={{ color: "var(--text-primary)", marginBottom: "0.5rem" }}
              >
                Zero Knowledge Encryption
              </h4>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  lineHeight: "1.6",
                }}
              >
                Every photo is encrypted with a unique key that only you have.
                We cannot see your photos, even if we wanted to.
              </p>
            </div>
            <div>
              <h4
                style={{ color: "var(--text-primary)", marginBottom: "0.5rem" }}
              >
                Original Quality
              </h4>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  lineHeight: "1.6",
                }}
              >
                We store your original RAW and high-res files without
                compression. What you upload is exactly what you get back.
              </p>
            </div>
            <div>
              <h4
                style={{ color: "var(--text-primary)", marginBottom: "0.5rem" }}
              >
                Smart Search
              </h4>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  lineHeight: "1.6",
                }}
              >
                AI-powered semantic search that runs entirely on our secure
                servers, indexing your encrypted metadata.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
