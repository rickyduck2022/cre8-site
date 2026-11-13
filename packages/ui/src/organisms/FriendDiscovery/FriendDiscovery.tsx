import { useId } from "react";
import {
  SuggestedFriend,
  type SuggestedFriendProps,
} from "../../molecules/SuggestedFriend/SuggestedFriend";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import "../Organisms.css";

export interface FriendDiscoveryProps {
  friends: SuggestedFriendProps[];
  title?: string;
  description?: string;
  className?: string;
}

export function FriendDiscovery({
  className,
  description = "Find people who share your music taste.",
  friends,
  title = "On your frequency",
}: FriendDiscoveryProps) {
  const headingId = useId();
  const pagination = usePagination(friends);

  return (
    <section
      aria-labelledby={headingId}
      className={["organism-card", "friend-discovery", className]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="organism-heading">
        <div>
          <h2 id={headingId}>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <ul className="friend-discovery__list" ref={pagination.listRef}>
        {pagination.items.map((friend) => (
          <li key={friend.name}>
            <SuggestedFriend {...friend} />
          </li>
        ))}
      </ul>
      <Pagination
        itemCount={friends.length}
        label="Friend suggestions"
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />
    </section>
  );
}
