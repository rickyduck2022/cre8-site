import { useEffect, useState } from "react";
import { Button, type Dub } from "@craft/ui";
import { PackView } from "./PackView";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { packRequest, signInForPack, type Pack } from "../services/packs";
import { downloadDubFile, DownloadSignInRequired } from "../services/downloadDubFile";
import "./SharedDubPage.css";
import "./Packs.css";

export function SharedPackPage({ packId }: { packId: string }) {
  const [result, setResult] = useState<{ pack: Pack; authenticated: boolean } | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const playback = useAudioPlayback(result?.pack.items.map(({ dub }) => dub) ?? [], setActionError, undefined, null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void packRequest<{ pack: Pack; authenticated: boolean }>(`/api/public/packs/${encodeURIComponent(packId)}`, "GET", undefined, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setResult(value); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The pack could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [packId, attempt]);
  useEffect(() => {
    const previous = document.title;
    document.title = result ? `${result.pack.title} | cre8` : "Shared pack | cre8";
    return () => { document.title = previous; };
  }, [result]);
  return <main className="shared-dub-page">
    <header className="shared-dub-page__brand"><a href="/"><img src="/cre8-main-logo.png" alt="cre8" /></a><span>Shared pack</span></header>
    <section className="shared-dub-page__card">
      {loading ? <p role="status">Loading pack...</p> : error ? <><h1>Pack unavailable</h1><p role="alert">{error}</p>
        <Button onClick={() => setAttempt((value) => value + 1)}>Try again</Button>
        <Button variant="secondary" onClick={() => signInForPack(packId)}>Sign in</Button></> : result && <PackView
        pack={result.pack} authenticated={result.authenticated} owner={false} playback={playback.state} standalone
        onActivateQueue={playback.activateQueue} onPrevious={playback.playPreviousDub} onNext={playback.playNextDub}
        shuffle={playback.state.shuffle} repeat={playback.state.repeat} onShuffleChange={playback.setShuffle} onRepeatChange={playback.setRepeat}
        onPlay={playback.togglePlayback} onPlayAll={playback.playQueue}
        onSeek={playback.seekPlaybackProgress} onVolume={playback.setVolume}
        onDownloadDub={async (dub: Dub) => {
          try { await downloadDubFile(dub.id); }
          catch (failure) { if (failure instanceof DownloadSignInRequired) signInForPack(packId); else throw failure; }
        }}
        onRefresh={async () => { setResult(await packRequest(`/api/public/packs/${encodeURIComponent(packId)}`)); }} />}
      {actionError && <p role="alert">{actionError}</p>}
    </section>
  </main>;
}
