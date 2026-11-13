import { useEffect, useRef, useState } from "react";
import { AudioPlayer, Button, PreviewNotice, TrackArtwork, type Dub } from "@craft/ui";
import { Download } from "@craft/icons";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { downloadDubFile, DownloadSignInRequired } from "../services/downloadDubFile";
import { signInForDubHash } from "../services/externalDubLinks";
import "./SharedDubPage.css";

interface SharedDubResponse {
  dub: Dub;
  authenticated: boolean;
}

export function SharedDubPage({ dubId }: { dubId: string }) {
  const [result, setResult] = useState<SharedDubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [downloadPending, setDownloadPending] = useState(false);
  const downloadInFlight = useRef(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const playback = useAudioPlayback(result ? [result.dub] : [], setActionError, undefined, null, undefined, { autoAdvance: false });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    async function load() {
      try {
        if (!dubId) throw new Error("This share link is missing a dub.");
        const response = await fetch(`/api/public/dubs/${encodeURIComponent(dubId)}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        const body = await response.json() as SharedDubResponse & { error?: string };
        if (!response.ok) throw new Error(body.error ?? `The shared dub could not be loaded (${response.status}).`);
        setResult(body);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "The shared dub could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [dubId, attempt]);

  useEffect(() => {
    const previous = document.title;
    document.title = result ? `${result.dub.title} by ${result.dub.artist} | cre8` : "Shared dub | cre8";
    return () => { document.title = previous; };
  }, [result]);

  function signIn() {
    window.location.hash = signInForDubHash(dubId);
  }

  async function download() {
    if (!result?.authenticated) { signIn(); return; }
    if (downloadInFlight.current) return;
    downloadInFlight.current = true;
    setDownloadPending(true);
    setActionError("");
    setDownloadComplete(false);
    try {
      await downloadDubFile(dubId);
      setDownloadComplete(true);
    } catch (error) {
      if (error instanceof DownloadSignInRequired) signIn();
      else setActionError(error instanceof Error ? error.message : "The download failed. Please try again.");
    } finally {
      downloadInFlight.current = false;
      setDownloadPending(false);
    }
  }

  const track = result?.dub;
  const noun = track?.mediaKind === "vocal" ? "vocal" : track?.mediaKind === "sample" ? "sample" : "dub";
  return (
    <main className="shared-dub-page">
      <header className="shared-dub-page__brand">
        <a href="/"><img src="/cre8-main-logo.png" alt="cre8" /></a>
        <span>Shared from the {track?.mediaKind === "vocal" ? "Vocal" : track?.mediaKind === "sample" ? "Sample" : "Dub"} Vault</span>
      </header>
      <section className="shared-dub-page__card" aria-label={`Shared ${noun}`}>
        {loading ? <p role="status">Loading shared dub...</p> : loadError ? (
          <>
            <h1>Dub unavailable</h1>
            <p role="alert">{loadError}</p>
            <Button onClick={() => setAttempt((current) => current + 1)} variant="secondary">Try again</Button>
          </>
        ) : track && (
          <>
            <TrackArtwork dub={track} large />
            <div className="shared-dub-page__identity">
              <span className="eyebrow">{track.distribution === "alist" ? "PUBLIC A-LIST" : "WORLDWIDE"}</span>
              <h1>{track.title}</h1>
              <p>{track.artist}</p>
            </div>
            {!result.authenticated && <PreviewNotice seconds={track.previewSeconds ?? 30} />}
            <AudioPlayer
              className="shared-dub-page__player"
              colorVariant="controller"
              mediaKind={track.mediaKind}
              transportVariant="minimal"
              contextLabel={result.authenticated ? "Full-quality audio" : "Preview playback"}
              distribution={track.distribution}
              track={{ title: track.title, artist: track.artist, duration: track.duration }}
              playing={playback.state.isPlaying}
              currentTimeSeconds={playback.state.currentTime}
              durationSeconds={playback.state.duration}
              volume={playback.state.volume}
              playbackError={playback.state.playbackError}
              onPlayChange={() => { setActionError(""); playback.togglePlayback(track); }}
              onSeekProgress={(progress) => playback.seekPlaybackProgress(progress, track)}
              onVolumeChange={playback.setVolume}
            />
            {actionError && <p className="shared-dub-page__error" role="alert">{actionError}</p>}
            {result.authenticated ? <Button disabled={downloadPending} loading={downloadPending} leadingIcon={<Download aria-hidden="true" />} onClick={() => void download()}>Download {noun}</Button>
              : <div className="shared-dub-page__actions">
                <Button onClick={signIn}>Sign in to listen in full</Button>
                <Button variant="secondary" leadingIcon={<Download aria-hidden="true" />} onClick={signIn}>Sign in to download</Button>
              </div>}
            <p className="shared-dub-page__hint">Downloads require a cre8 account and count as a like.</p>
            {track.mediaKind !== "dub" && track.mediaKind && <p className="shared-dub-page__hint">Download access does not grant reuse rights. Check the creator's licence before using this file in a production.</p>}
            {downloadComplete && <p role="status">Download started. Your like is counted once.</p>}
          </>
        )}
      </section>
    </main>
  );
}
