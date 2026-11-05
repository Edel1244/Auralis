import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AURALIS",
    short_name: "AURALIS",
    description: "Open-source, community-driven music platform.",
    start_url: "/home",
    display: "standalone",
    background_color: "#080B10",
    theme_color: "#008CFF",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/auralis-mark.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
