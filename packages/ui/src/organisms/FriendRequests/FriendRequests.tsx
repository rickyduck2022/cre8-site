import { useId } from "react";
import {
  FriendRequest,
  type FriendRequestProps,
} from "../../molecules/FriendRequest/FriendRequest";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import "../Organisms.css";

export interface FriendRequestsProps {
  requests: FriendRequestProps[];
  title?: string;
  description?: string;
  className?: string;
}

export function FriendRequests({
  className,
  description,
  requests,
  title = "Friend requests",
}: FriendRequestsProps) {
  const headingId = useId();
  const pagination = usePagination(requests);

  return (
    <section
      aria-labelledby={headingId}
      className={["organism-card", "friend-requests", className]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="organism-heading">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <span aria-label={`${requests.length} requests`}>
          {requests.length}
        </span>
      </header>
      <ul className="friend-requests__list" ref={pagination.listRef}>
        {pagination.items.map((request) => (
          <li key={request.name}>
            <FriendRequest {...request} />
          </li>
        ))}
      </ul>
      <Pagination
        itemCount={requests.length}
        label="Friend requests"
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />
    </section>
  );
}
