import { Disc3 } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { DubCardList, type DubCardListProps } from "../shared/DubCardList";
import type { LibraryDownload } from "../communityTypes";
import "../CommunityPageTemplates.css";

export interface LibraryTemplateProps extends Omit<DubCardListProps, "entries" | "label" | "onEdit" | "onDelete"> {
  downloads: LibraryDownload[];
  onEditDub?: DubCardListProps["onEdit"];
  onDeleteDub?: DubCardListProps["onDelete"];
}

export function LibraryTemplate({ downloads, onEditDub, onDeleteDub, ...cardProps }: LibraryTemplateProps) {
  return (
    <div className="library-template">
      <section className="page-intro">
        <div><span className="eyebrow">YOUR COLLECTION</span><h1>My Library</h1>
          <p>Your downloaded dubs, ready to listen to again.</p></div>
        <Badge>{downloads.length} downloads</Badge>
      </section>
      {downloads.length ? (
        <DubCardList {...cardProps} entries={downloads} label="Downloaded dubs" onEdit={onEditDub} onDelete={onDeleteDub} />
      ) : (
        <div className="empty-state"><Disc3 aria-hidden="true" /><strong>Your library is empty</strong>
          <span>Download a dub from the feed or a conversation and it will be saved here.</span></div>
      )}
    </div>
  );
}
