import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Müşteri Hesap Takibi",
    short_name: "Hesap Takibi",
    description: "Satış, taksit ve tahsilat takibi",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#123253",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
