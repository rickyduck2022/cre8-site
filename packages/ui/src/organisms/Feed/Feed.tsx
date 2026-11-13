import { useId } from "react";
import { FeedControls } from "../../molecules/FeedControls/FeedControls";
import { ShareEntry } from "../../molecules/ShareEntry/ShareEntry";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { DubPost, type DubPostProps } from "../DubPost/DubPost";
import "../Organisms.css";

export interface FeedProps {
  posts: DubPostProps[];
  userName: string;
  variant?: "default" | "embedded" | "mobile";
  title?: string;
  description?: string;
  onShare?: (message: string) => void;
  onUpload?: () => void;
  className?: string;
}

export function Feed({
  className,
  description = "Discover fresh sounds shared by your friends.",
  onShare,
  onUpload,
  posts,
  title = "Fresh from your circle.",
  userName,
  variant = "default",
}: FeedProps) {
  const headingId = useId();
  const pagination = usePagination(posts);

  return (
    <section
      aria-labelledby={headingId}
      className={[
        "organism-card",
        "feed",
        variant !== "default" && `feed--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="feed__header">
        <div>
          <h2 className="feed__heading" id={headingId}>
            {title}
          </h2>
          <p className="feed__subtitle">{description}</p>
        </div>
      </header>
      <ShareEntry
        name={userName}
        onSubmit={onShare}
        onUpload={onUpload}
        variant={variant === "mobile" ? "mobile" : "default"}
      />
      <FeedControls />
      <div className="feed__posts" ref={pagination.listRef}>
        {pagination.items.map((post, index) => (
          <DubPost key={`${post.author}-${post.track.title}-${index}`} {...post} />
        ))}
      </div>
      <Pagination
        itemCount={posts.length}
        label="Feed posts"
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />
    </section>
  );
}
