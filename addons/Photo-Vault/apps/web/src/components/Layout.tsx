import React, { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { TopNav } from "./TopNav";
import { SideNav } from "./SideNav";
import { useAuth } from "../app/AuthProvider";
import { useSubscription } from "../hooks/useSubscription";
import { useOffline } from "../hooks/useOffline";
import { Banner } from "./Banner";
import { isMasterKeyCached, setCachedMasterKey } from "../crypto/vaultKey";
import { VaultUnlockModal } from "./VaultUnlockModal";
import { useEmailVerificationResend } from "../hooks/useEmailVerificationResend";
import { retrieveTrustedMasterKeyForDevice } from "../crypto/trustedDevice";

export const Layout: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { subscription, trialDaysRemaining, isTrial, isPastDue, isExpired } =
    useSubscription();
  const isOffline = useOffline();
  const [vaultUnlockModalOpen, setVaultUnlockModalOpen] = useState(false);
  const [dismissedBanners, setDismissedBanners] = useState<
    Record<string, boolean | number>
  >({});
  const [exportPromotionVisible, setExportPromotionVisible] = useState(false);
  const [, forceRerender] = useState(0);
  const { resend, isSending, cooldownSecondsRemaining, lastResult } =
    useEmailVerificationResend();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("booster_vault_dismissed_banners");
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        setDismissedBanners(parsed as Record<string, boolean | number>);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "booster_vault_dismissed_banners",
        JSON.stringify(dismissedBanners),
      );
    } catch {
      // ignore
    }
  }, [dismissedBanners]);

  const handleDismissBanner = useCallback(
    (bannerId: string, timestamp?: number) => {
      setDismissedBanners((prev) => ({
        ...prev,
        [bannerId]: timestamp !== undefined ? timestamp : true,
      }));
    },
    [],
  );

  const handleUnlockSuccess = () => {
    setVaultUnlockModalOpen(false);
    // Force a rerender so banners react to the in-memory cache.
    forceRerender((x) => x + 1);
  };

  const handleResendVerification = async () => {
    await resend();
  };

  const handleRefreshStatus = async () => {
    await refreshUser();
  };

  const isMasterKeyLoaded = isMasterKeyCached();

  // Try restoring a trusted-device master key (passwordless) on app load.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) return;
      if (isMasterKeyCached()) return;

      const restored = await retrieveTrustedMasterKeyForDevice(user.id);
      if (cancelled) return;

      if (restored) {
        setCachedMasterKey(restored);
        forceRerender((x) => x + 1);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Email not verified banner
  const showEmailNotVerified =
    user && !user.emailVerified && !dismissedBanners["email-not-verified"];

  // Subscription banner - Only show for Trial or Issues
  const showSubscriptionBanner =
    subscription &&
    !dismissedBanners["subscription"] &&
    (isTrial || isPastDue || isExpired);

  // Vault locked indicator
  const showVaultLocked =
    !isMasterKeyLoaded && !dismissedBanners["vault-locked"];

  // Export promotion banner (show once a week)
  const lastExportBannerShown = dismissedBanners["export-promotion-timestamp"];
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const canShowExportPromotion =
    user &&
    isMasterKeyLoaded &&
    !dismissedBanners["export-promotion"] &&
    (!lastExportBannerShown ||
      (typeof lastExportBannerShown === "number" &&
        lastExportBannerShown < oneWeekAgo));

  useEffect(() => {
    if (!canShowExportPromotion) return;
    if (exportPromotionVisible) return;
    setExportPromotionVisible(true);
    handleDismissBanner("export-promotion-timestamp", Date.now());
  }, [canShowExportPromotion, exportPromotionVisible, handleDismissBanner]);

  const showExportPromotion = canShowExportPromotion && exportPromotionVisible;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "var(--bg-primary)",
      }}
    >
      <TopNav user={user} />

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }}
      >
        <SideNav />
        <main
          id="main-content"
          style={{
            flex: 1,
            padding: "var(--space-8)",
            overflow: "auto",
            backgroundColor: "var(--bg-primary)",
          }}
        >
          {/* Global Banners - Moved inside main content area */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            {isOffline && (
              <Banner
                type="warning"
                title="You're offline"
                message="Some features may be unavailable. Uploads are disabled until you reconnect."
                onDismiss={() => handleDismissBanner("offline-warning")}
              />
            )}

            {showEmailNotVerified && (
              <Banner
                type="warning"
                title="Your email is not verified"
                message={
                  <>
                    <div>Some features may be limited.</div>
                    {!user?.email && (
                      <div style={{ marginTop: "0.5rem" }}>
                        Loading your email…
                      </div>
                    )}
                    {lastResult && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          color: lastResult.success
                            ? "var(--success)"
                            : "var(--danger)",
                          fontWeight: "500",
                        }}
                      >
                        {lastResult.message}
                      </div>
                    )}
                  </>
                }
                action={{
                  label:
                    cooldownSecondsRemaining > 0
                      ? `Resend in ${cooldownSecondsRemaining}s`
                      : isSending
                        ? "Sending..."
                        : "Resend verification email",
                  onClick:
                    cooldownSecondsRemaining > 0 || !user?.email
                      ? undefined
                      : handleResendVerification,
                  disabled:
                    cooldownSecondsRemaining > 0 || isSending || !user?.email,
                }}
                secondaryAction={{
                  label: "I've verified — refresh",
                  onClick: handleRefreshStatus,
                }}
                onDismiss={() => handleDismissBanner("email-not-verified")}
              />
            )}

            {showSubscriptionBanner && (
              <Banner
                type={
                  isPastDue || isExpired
                    ? "danger"
                    : isTrial
                      ? "info"
                      : "success"
                }
                title={`Subscription: ${subscription.subscriptionStatus}`}
                message={(() => {
                  if (isTrial && trialDaysRemaining !== undefined) {
                    return `Trial ends in ${trialDaysRemaining} days.`;
                  }
                  if (isPastDue || isExpired) {
                    return "Uploads disabled. Please update your billing information.";
                  }
                  return null; // Don't show message for regular active info
                })()}
                action={
                  isPastDue || isExpired
                    ? {
                        label: "Update Billing",
                        to: "/app/vault/billing",
                      }
                    : undefined
                }
                onDismiss={() => handleDismissBanner("subscription")}
              />
            )}

            {showVaultLocked && (
              <Banner
                type="warning"
                title="Vault locked"
                message="Unlock to access media."
                action={{
                  label: "Unlock",
                  onClick: () => setVaultUnlockModalOpen(true),
                }}
                onDismiss={() => handleDismissBanner("vault-locked")}
              />
            )}

            {/* Removed Vault Unlocked success banner to save space */}

            {showExportPromotion && (
              <Banner
                type="info"
                title="Export Your Data"
                message="Maintain regular backups of your memories. Export your entire vault or specific albums to keep offline copies."
                action={{
                  label: "Create Export",
                  to: "/app/vault/exports",
                }}
                onDismiss={() => {
                  handleDismissBanner("export-promotion");
                  setExportPromotionVisible(false);
                }}
              />
            )}
          </div>

          <Outlet />
        </main>
      </div>

      <VaultUnlockModal
        open={vaultUnlockModalOpen}
        onClose={() => setVaultUnlockModalOpen(false)}
        onUnlockSuccess={handleUnlockSuccess}
        title="Unlock Vault"
        message="Enter your vault password to unlock and access your media."
      />
    </div>
  );
};
