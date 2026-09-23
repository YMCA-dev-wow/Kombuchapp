// Service worker minimal de YMCA Kombucha.
// Volontairement AUCUN cache : le stock doit toujours être affiché en
// temps réel, on ne veut jamais servir une version périmée de la boutique.
// Ce fichier sert à rendre l'appli installable et servira de point
// d'entrée plus tard pour les notifications Web Push.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
