import "./PreviewNotice.css";

export interface PreviewNoticeProps {
  seconds?: number;
  sharing?: boolean;
}

export function PreviewNotice({ seconds, sharing = false }: PreviewNoticeProps) {
  return <section className="preview-notice" aria-label="Preview limitations">
    <strong>Reduced-quality preview</strong>
    <p>{seconds ? `First ${seconds} seconds maximum` : "Each file is shortened to its preview length"} &middot; Not the full-quality upload</p>
    <dl>
      <div><dt>Preview bitrate</dt><dd>256 kbps WAV</dd></div>
      <div><dt>Preview audio</dt><dd>16 kHz &middot; mono</dd></div>
    </dl>
    <p>{sharing ? "Guests hear a shortened, reduced-quality version from the start. Signed-in listeners with access can hear the full-length original." : "Sign in for full-length, original-quality playback and downloads."}</p>
  </section>;
}
