import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefCallback } from "react";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export type PageSize = 5 | 10 | 20;

export interface PaginationState<T> {
  items: T[];
  page: number;
  pageSize: PageSize;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: PageSize) => void;
  listRef: RefCallback<HTMLElement>;
}

export function usePagination<T>(
  items: T[],
  resetKey?: string | number,
): PaginationState<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(5);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const list = useRef<HTMLElement | null>(null);
  const listRef = useCallback((element: HTMLElement | null) => { list.current = element; }, []);
  const previous = useRef({ page: currentPage, pageSize });

  useLayoutEffect(() => {
    const changed = previous.current.page !== currentPage || previous.current.pageSize !== pageSize;
    previous.current = { page: currentPage, pageSize };
    const element = list.current;
    if (!changed || !element) return;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (!/auto|scroll/.test(style.overflowY || style.overflow)) continue;
      parent.scrollTop = Math.max(0, parent.scrollTop + element.getBoundingClientRect().top
        - parent.getBoundingClientRect().top - parent.clientTop);
      return;
    }
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = Math.max(0, document.scrollingElement.scrollTop + element.getBoundingClientRect().top);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, resetKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return {
    items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    page: currentPage,
    pageSize,
    totalPages,
    setPage,
    setPageSize,
    listRef,
  };
}

export interface PaginationProps {
  itemCount: number;
  page: number;
  pageSize: PageSize;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  className?: string;
  label?: string;
}

export function Pagination({
  className,
  itemCount,
  label = "List",
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  totalPages,
}: PaginationProps) {
  if (itemCount <= 5) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, itemCount);

  return (
    <div
      aria-label={`${label} pagination`}
      className={["pagination", className].filter(Boolean).join(" ")}
      role="group"
    >
      <span className="pagination__summary">
        {firstItem}–{lastItem} of {itemCount}
      </span>
      <label className="pagination__page-size">
        <span>Rows</span>
        <select
          aria-label={`${label} rows per page`}
          onChange={(event) => onPageSizeChange(Number(event.currentTarget.value) as PageSize)}
          value={pageSize}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
      </label>
      <div className="pagination__controls">
        <Button
          aria-label={`Previous ${label} page`}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          size="small"
          variant="tertiary"
        >
          Previous
        </Button>
        <span aria-live="polite" className="pagination__page-number">
          {page} / {totalPages}
        </span>
        <Button
          aria-label={`Next ${label} page`}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          size="small"
          variant="tertiary"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
