import { Download, Disc3 } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { Badge } from "../../atoms/Badge/Badge";
import { TrackTag } from "../../atoms/TrackTag/TrackTag";
import type { LibraryDownload } from "../communityTypes";
import { formatLocalTimestamp } from "../templateFormatters";
import { TrackArtwork } from "../shared/TrackArtwork";
import "../CommunityPageTemplates.css";

export interface LibraryTemplateProps {
  downloads: LibraryDownload[];
  onDownload: (dub: LibraryDownload["dub"]) => void;
}

export function LibraryTemplate({ downloads, onDownload }: LibraryTemplateProps) {
  return (
    <div className="library-template">
      <section className="page-intro">
        <div><span className="eyebrow">YOUR COLLECTION</span><h1>My Library</h1>
          <p>Your downloaded dubs, ready to listen to again.</p></div>
        <Badge>{downloads.length} downloads</Badge>
      </section>
      {downloads.length ? (
        <ul className="library-list" aria-label="Downloaded dubs">
          {downloads.map(({ downloadedAt, dub }, index) => (
            <li key={`${dub.id}-${downloadedAt}-${index}`}>
              <TrackArtwork dub={dub} />
              <div className="library-list__details">
                <strong>{dub.title}</strong><span>{dub.artist}</span>
                <div>{(dub.tags?.length ? dub.tags : [dub.genre]).map((tag) => <TrackTag key={tag}>{tag}</TrackTag>)}</div>
              </div>
              <time dateTime={downloadedAt}>Downloaded {formatLocalTimestamp(downloadedAt)}</time>
              <Button leadingIcon={<Download />} onClick={() => onDownload(dub)} size="small" variant="secondary">Download again</Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state"><Disc3 aria-hidden="true" /><strong>Your library is empty</strong>
          <span>Download a dub from the feed or a conversation and it will be saved here.</span></div>
      )}
    </div>
  );
}
