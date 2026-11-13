import { Download } from "@craft/icons";
import type { DubPack } from "../../types/domain";
import "../DubStatistics/DubStatistics.css";
import "./DubPackStatistics.css";

export function DubPackStatistics({ pack }: { pack: DubPack }) {
  const fileDownloads = pack.items.reduce((total, { dub }) => total + dub.downloads, 0);
  return (
    <section className={`dub-pack-statistics media-kind--${pack.kind}${pack.distribution === "alist" ? " dub-pack-statistics--alist" : ""}`} aria-label={`Download statistics for ${pack.title}`}>
      <dl className="dub-statistics__charts">
        <div className="dub-statistics__metric">
          <dt className="dub-statistics__label"><Download aria-hidden="true" />Whole-pack ZIP downloads</dt>
          <dd className="dub-statistics__value">{pack.zipDownloads === undefined ? "Unavailable" : pack.zipDownloads.toLocaleString()}</dd>
        </div>
        <div className="dub-statistics__metric">
          <dt className="dub-statistics__label"><Download aria-hidden="true" />Total file downloads</dt>
          <dd className="dub-statistics__value">{fileDownloads.toLocaleString()}</dd>
        </div>
      </dl>
      <p className="dub-statistics__note">Counts reflect download requests, not completed transfers. File counts include ZIP downloads and downloads outside this pack. ZIP tracking starts with this update.</p>
      {pack.items.length > 0 && <table className="dub-pack-statistics__files">
        <caption>{pack.kind === "vocal" ? "Individual vocal downloads" : pack.kind === "sample" ? "Individual sample downloads" : "Individual track downloads"}</caption>
        <thead><tr><th scope="col">{pack.kind === "vocal" ? "Vocal" : pack.kind === "sample" ? "Sample" : "Track"}</th><th scope="col">Downloads</th></tr></thead>
        <tbody>{pack.items.map(({ dub }) => <tr key={dub.id}><th scope="row">{dub.title}</th><td>{dub.downloads.toLocaleString()}</td></tr>)}</tbody>
      </table>}
    </section>
  );
}
