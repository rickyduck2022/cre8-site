import { useEffect, useState, type ReactNode } from "react";
import { App as CommunityApp } from "./app/App";
import { SharedDubPage } from "./components/SharedDubPage";
import { sharedDubIdFromHash } from "./services/externalDubLinks";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { SharedPackPage } from "./components/SharedPackPage";

export function App({ appStatus }: { appStatus?: ReactNode } = {}) {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const dubId = sharedDubIdFromHash(hash);
  const packId = hash.split("?")[0] === "#pack" ? new URLSearchParams(hash.split("?")[1]).get("id") ?? "" : null;
  return <AppErrorBoundary key={packId ?? dubId ?? "community"}>{packId !== null ? <SharedPackPage key={packId} packId={packId} /> : dubId === null
    ? <CommunityApp appStatus={appStatus} />
    : <SharedDubPage key={dubId} dubId={dubId} />}</AppErrorBoundary>;
}
