import type { MetadataRoute } from "next";

import { pwaConfig } from "@/lib/constants/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: pwaConfig.name,
    short_name: pwaConfig.shortName,
    description: pwaConfig.description,
    start_url: pwaConfig.startUrl,
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#1d4ed8",
    icons: [],
  };
}
