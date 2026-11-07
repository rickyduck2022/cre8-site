import { useId } from "react";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import "../Organisms.css";

export interface OnlineFriend {
  name: string;
  src?: string;
  href?: string;
}

export interface OnlineFriendsGroup {
  title: string;
  friends: OnlineFriend[];
}

export interface OnlineFriendsProps {
  groups: OnlineFriendsGroup[];
  title?: string;
  className?: string;
}

export function OnlineFriends({
  className,
  groups,
  title = "Online friends",
}: OnlineFriendsProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={["organism-card", "online-friends", className]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="organism-heading">
        <h2 id={headingId}>{title}</h2>
      </header>
      <ul className="online-friends__list">
        {groups.map((group) => (
          <OnlineFriendsGroupView group={group} key={group.title} />
        ))}
      </ul>
    </section>
  );
}

function OnlineFriendsGroupView({ group }: { group: OnlineFriendsGroup }) {
  const pagination = usePagination(group.friends);

  return (
    <li className="online-friends__group">
      <span className="online-friends__label">{group.title}</span>
      <div className="online-friends__people">
        {pagination.items.map((friend) => (
          <a
            className="online-friends__person"
            href={friend.href ?? "#"}
            key={friend.name}
          >
            <Avatar
              name={friend.name}
              size="small"
              src={friend.src}
              status="active"
            />
            <span>{friend.name}</span>
          </a>
        ))}
      </div>
      <Pagination
        itemCount={group.friends.length}
        label={`${group.title} friends`}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />
    </li>
  );
}
