import { useEffect, useRef, useState, type ReactNode } from "react";
import "./PwaStatus.css";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface RegistrationOptions {
  immediate: boolean;
  onNeedRefresh: () => void;
  onRegisterError: (error: unknown) => void;
}

export type RegisterServiceWorker = (options: RegistrationOptions) => (reloadPage?: boolean) => Promise<void>;

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function PwaStatusProvider({
  register, children,
}: {
  register: RegisterServiceWorker;
  children: (status: ReactNode) => ReactNode;
}) {
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [error, setError] = useState("");
  const update = useRef<ReturnType<RegisterServiceWorker> | null>(null);

  useEffect(() => {
    let active = true;
    update.current = register({
      immediate: true,
      onNeedRefresh: () => { if (active) setUpdateReady(true); },
      onRegisterError: (registrationError) => {
        console.error("Service worker registration failed:", registrationError);
        if (active) setError("Offline app support could not be enabled. Please reload when online.");
      },
    });
    const wentOnline = () => setOnline(true);
    const wentOffline = () => setOnline(false);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const appInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("online", wentOnline);
    window.addEventListener("offline", wentOffline);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      active = false;
      window.removeEventListener("online", wentOnline);
      window.removeEventListener("offline", wentOffline);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, [register]);

  async function install() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch (installError) {
      console.error("App installation failed:", installError);
      setInstallPrompt(null);
      setError("The install prompt could not be opened. Try installing from your browser menu.");
    }
  }

  async function applyUpdate() {
    try {
      await update.current?.(true);
    } catch (updateError) {
      console.error("App update failed:", updateError);
      setError("The update could not be applied. Please try again when online.");
    }
  }

  const showInstall = !installed && !installDismissed && (installPrompt !== null || isAppleMobile());
  if (online && !showInstall && !updateReady && !error) return children(null);

  return children(
    <aside className="pwa-status" aria-label="App status">
      {!online && <p role="status">You are offline. Messages, uploads, downloads and streaming need a connection. Changes are not queued.</p>}
      {error && <p role="alert">{error}</p>}
      {updateReady && (
        <div className="pwa-status__row">
          <span>A new version is ready. Updating reloads the app and stops playback.</span>
          <button type="button" onClick={() => void applyUpdate()}>Update app</button>
        </div>
      )}
      {showInstall && (
        <div className="pwa-status__row pwa-status__install">
          {installPrompt ? (
            <>
              <span>Install cre8 for an app-like experience.</span>
              <button type="button" onClick={() => void install()}>Install app</button>
            </>
          ) : (
            <span>To install cre8, open the Share menu in your browser and choose Add to Home Screen.</span>
          )}
          <button type="button" aria-label="Dismiss install suggestion" onClick={() => setInstallDismissed(true)}>Dismiss</button>
        </div>
      )}
    </aside>
  );
}
