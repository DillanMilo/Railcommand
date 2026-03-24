"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface PWAContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isUpdateAvailable: boolean;
  isOffline: boolean;
  triggerInstall: () => Promise<boolean>;
  triggerUpdate: () => void;
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  isInstalled: false,
  isUpdateAvailable: false,
  isOffline: false,
  triggerInstall: async () => false,
  triggerUpdate: () => {},
});

export const usePWA = () => useContext(PWAContext);

export default function ServiceWorkerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Detect if already installed (standalone mode)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
        || (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // Capture install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Detect successful install
    const installedHandler = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Skip on localhost for dev
    const isLocalhost = window.location.hostname === "localhost"
      || window.location.hostname === "127.0.0.1";
    if (isLocalhost) {
      console.log("[SW] Skipping registration on localhost");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);
        console.log("[SW] Registered:", reg.scope);

        // Check for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setIsUpdateAvailable(true);
            }
          });
        });
      })
      .catch((error) => {
        console.log("[SW] Registration failed:", error);
      });
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === "accepted";
  }, [deferredPrompt]);

  const triggerUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    }
  }, [registration]);

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isUpdateAvailable,
        isOffline,
        triggerInstall,
        triggerUpdate,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}
