import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll the main content area
    const main = document.getElementById("main-content");
    if (main) {
      main.scrollTo(0, 0);
    }
    // Also scroll window just in case
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
