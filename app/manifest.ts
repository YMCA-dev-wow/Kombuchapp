import type { MetadataRoute } from "next";

// Manifeste de l'application installable (PWA). C'est ce fichier qui
// permet d'"installer" le site sur l'écran d'accueil du téléphone et de
// l'ouvrir en plein écran comme une vraie appli, sans passer par un
// store (App Store / Google Play).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YMCA Kombucha",
    short_name: "YMCA Kombucha",
    description: "Commande ton kombucha maison directement en ligne.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Raccourci accessible par appui long sur l'icône (Android).
    shortcuts: [
      { name: "Espace producteur", url: "/admin", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
