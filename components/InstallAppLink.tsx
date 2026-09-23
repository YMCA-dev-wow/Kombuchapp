"use client";

import { useEffect, useState } from "react";

// Événement non standard (Chrome/Edge/Android) déclenché quand le
// navigateur estime que le site peut être installé comme une appli.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "autre";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // Les iPad récents se présentent comme un Mac : on les repère au tactile.
  const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (isIos) return "ios";
  if (/Android/.test(ua)) return "android";
  return "autre";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallAppLink() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("autre");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Pas bloquant : le site fonctionne normalement sans service worker.
      });
    }

    // Détection côté navigateur uniquement (inconnue au rendu serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Déjà ouvert depuis l'appli installée : inutile d'afficher le lien.
  if (installed) return null;

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    setShowHelp((v) => !v);
  }

  return (
    <div className="mt-2">
      <button onClick={handleClick} className="underline">
        Télécharger l&apos;application
      </button>
      {showHelp && (
        <p className="mx-auto mt-2 max-w-xs text-[11px] leading-relaxed">
          {platform === "ios" ? (
            <>
              Sur iPhone : ouvre ce site dans <strong>Safari</strong>, appuie sur le bouton{" "}
              <strong>Partager</strong> (carré avec une flèche), puis sur{" "}
              <strong>Sur l&apos;écran d&apos;accueil</strong>.
            </>
          ) : platform === "android" ? (
            <>
              Sur Android : ouvre le menu <strong>⋮</strong> de Chrome, puis{" "}
              <strong>Installer l&apos;application</strong> (ou <strong>Ajouter à l&apos;écran d&apos;accueil</strong>).
            </>
          ) : (
            <>
              Sur ordinateur : clique sur l&apos;icône d&apos;installation à droite de la barre d&apos;adresse
              (Chrome ou Edge). Sur téléphone, ouvre ce site et utilise « Ajouter à l&apos;écran d&apos;accueil ».
            </>
          )}
        </p>
      )}
    </div>
  );
}
