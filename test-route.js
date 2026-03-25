const pathnames = ['/support', '/forgot-password', '/u/someone', '/privacy', '/'];

pathnames.forEach(pathname => {
  const topLevelPath = pathname.split("/").filter(Boolean);
  const isCanonicalPublicProfileRoute =
    topLevelPath.length === 1 &&
    topLevelPath[0] !== "login" &&
    topLevelPath[0] !== "signup" &&
    topLevelPath[0] !== "support" &&
    topLevelPath[0] !== "terms" &&
    topLevelPath[0] !== "privacy" &&
    topLevelPath[0] !== "forgot-password" &&
    topLevelPath[0] !== "reset-password" &&
    topLevelPath[0] !== "verify-email";

  const isFullscreenRoute =
    pathname.startsWith("/u/") ||
    pathname.startsWith("/q/") ||
    isCanonicalPublicProfileRoute;

  console.log({ pathname, isCanonicalPublicProfileRoute, isFullscreenRoute });
});
