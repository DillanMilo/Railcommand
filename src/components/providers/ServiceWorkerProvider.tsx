"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { checkSupabaseConnectivity } from "@/lib/supabase/connectivity";
import {
  clearOfflineDataForUser,
  getOfflineDatabaseName,
  initializeOfflineStorage,
  OFFLINE_SCOPE_STORAGE_KEY,
  readOfflineMetadata,
  requestPersistentOfflineStorage,
  writeOfflineMetadata,
} from "@/lib/offline/storage";

const isDevelopment = process.env.NODE_ENV === "development";
const CONNECTIVITY_CHECK_INTERVAL_MS = 60_000;

function setActiveOfflineScope(userId: string | null): void {
  try {
    if (userId) {
      localStorage.setItem(OFFLINE_SCOPE_STORAGE_KEY, getOfflineDatabaseName(userId));
    } else {
      localStorage.removeItem(OFFLINE_SCOPE_STORAGE_KEY);
    }
  } catch {
    // Unavailable storage must not turn session loss into a destructive cleanup.
  }
}

function isDevelopmentOfflineSimulation(): boolean {
  return isDevelopment
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("simulate-offline") === "1";
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean };
export type ConnectivityStatus = "checking" | "online" | "offline";

interface PWAContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isUpdateAvailable: boolean;
  isOffline: boolean;
  connectivityStatus: ConnectivityStatus;
  lastConnectedAt: string | null;
  lastSyncedAt: string | null;
  triggerInstall: () => Promise<boolean>;
  triggerUpdate: () => void;
  retryConnectivity: () => Promise<void>;
  markSynced: (userId?: string) => Promise<void>;
  clearOfflineData: (userId?: string) => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  isInstalled: false,
  isUpdateAvailable: false,
  isOffline: false,
  connectivityStatus: "checking",
  lastConnectedAt: null,
  lastSyncedAt: null,
  triggerInstall: async () => false,
  triggerUpdate: () => {},
  retryConnectivity: async () => {},
  markSynced: async () => {},
  clearOfflineData: async () => {},
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
  const [connectivityStatus, setConnectivityStatus] =
    useState<ConnectivityStatus>("checking");
  const [lastConnectedAt, setLastConnectedAt] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [offlineUserId, setOfflineUserId] = useState<string | null>(null);
  const offlineUserIdRef = useRef<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    offlineUserIdRef.current = offlineUserId;
  }, [offlineUserId]);

  // Resolve the local Supabase session without a network request, then keep the
  // offline database scope aligned with authentication changes.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let authChanged = false;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && !authChanged) {
        offlineUserIdRef.current = session?.user.id ?? null;
        setOfflineUserId(offlineUserIdRef.current);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      authChanged = true;
      const nextUserId = session?.user.id ?? null;
      offlineUserIdRef.current = nextUserId;
      if (event === "SIGNED_OUT") {
        // Expired/revoked sessions also emit SIGNED_OUT. Hide private offline
        // data, but retain drafts/outbox for the same user's next sign-in.
        // Only the confirmed sign-out flow may delete the user's database.
        setActiveOfflineScope(null);
        setLastConnectedAt(null);
        setLastSyncedAt(null);
      }
      setOfflineUserId(nextUserId);
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!offlineUserId) {
      setLastConnectedAt(null);
      setLastSyncedAt(null);
      return;
    }

    let cancelled = false;

    void Promise.all([
      initializeOfflineStorage(offlineUserId).finally(() => {
        // An initialization already in flight must not restore a signed-out
        // user's public-fallback scope after an authentication change.
        if (offlineUserIdRef.current !== offlineUserId) {
          setActiveOfflineScope(offlineUserIdRef.current);
        }
      }),
      readOfflineMetadata<string>(offlineUserId, "last_connected_at"),
      readOfflineMetadata<string>(offlineUserId, "last_synced_at"),
      requestPersistentOfflineStorage(),
    ])
      .then(([, connectedAt, syncedAt]) => {
        if (cancelled) return;
        setLastConnectedAt(connectedAt);
        setLastSyncedAt(syncedAt);
      })
      .catch((error) => {
        if (isDevelopment) console.warn("[Offline] Initialization failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [offlineUserId]);

  const retryConnectivity = useCallback(async () => {
    // Local acceptance tests can exercise the complete offline UI/outbox path
    // without changing the host machine's network connection. Production
    // builds always use real browser and Supabase connectivity signals.
    if (isDevelopmentOfflineSimulation()) {
      setConnectivityStatus("offline");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setConnectivityStatus("offline");
      return;
    }

    setConnectivityStatus("checking");
    const result = await checkSupabaseConnectivity();

    if (!result.ok) {
      setConnectivityStatus("offline");
      return;
    }

    setConnectivityStatus("online");
    setLastConnectedAt(result.checkedAt);
    const userId = offlineUserIdRef.current;
    if (userId) {
      await writeOfflineMetadata(userId, "last_connected_at", result.checkedAt).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as NavigatorWithStandalone).standalone === true;
    setIsInstalled(isStandalone);

    const handleOnline = () => void retryConnectivity();
    const handleOffline = () => setConnectivityStatus("offline");
    const handleFocus = () => void retryConnectivity();

    void retryConnectivity();
    const interval = window.setInterval(
      () => void retryConnectivity(),
      CONNECTIVITY_CHECK_INTERVAL_MS
    );
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
    };
  }, [retryConnectivity]);

  useEffect(() => {
    const handler = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
    };
    const installedHandler = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost = window.location.hostname === "localhost"
      || window.location.hostname === "127.0.0.1";
    if (isLocalhost) {
      if (isDevelopment) console.log("[SW] Skipping registration on localhost");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);
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
        if (isDevelopment) console.warn("[SW] Registration failed:", error);
      });
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
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

  const markSynced = useCallback(async (requestedUserId?: string) => {
    const userId = requestedUserId ?? offlineUserIdRef.current;
    if (!userId) return;
    const syncedAt = new Date().toISOString();
    await writeOfflineMetadata(userId, "last_synced_at", syncedAt);
    if (userId === offlineUserIdRef.current) setLastSyncedAt(syncedAt);
  }, []);

  const clearOfflineData = useCallback(async (requestedUserId?: string) => {
    const userId = requestedUserId ?? offlineUserIdRef.current;
    if (!userId) return;
    await clearOfflineDataForUser(userId);
    if (userId === offlineUserIdRef.current) {
      setLastConnectedAt(null);
      setLastSyncedAt(null);
    }
  }, []);

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isUpdateAvailable,
        isOffline: connectivityStatus === "offline",
        connectivityStatus,
        lastConnectedAt,
        lastSyncedAt,
        triggerInstall,
        triggerUpdate,
        retryConnectivity,
        markSynced,
        clearOfflineData,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}
