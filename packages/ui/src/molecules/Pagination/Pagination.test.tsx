import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Pagination, usePagination } from "./Pagination";

function TestPaginatedList() {
  const rows = usePagination(Array.from({ length: 12 }, (_, index) => index + 1));
  return (
    <>
      <ul ref={rows.listRef}>
        {rows.items.map((row) => <li key={row}>{row}</li>)}
      </ul>
      <Pagination
        itemCount={12}
        label="Test rows"
        onPageChange={rows.setPage}
        onPageSizeChange={rows.setPageSize}
        page={rows.page}
        pageSize={rows.pageSize}
        totalPages={rows.totalPages}
      />
    </>
  );
}

describe("Pagination", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("defaults to five rows and supports changing page and page size", () => {
    render(<TestPaginatedList />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("1–5 of 12")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next Test rows page" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("6")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Test rows rows per page" }), {
      target: { value: "10" },
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("1–10 of 12")).toBeInTheDocument();
  });

  it("aligns the new page with its nearest scroll viewport without scrolling the surrounding page or moving focus", () => {
    const view = render(<div data-testid="outer" style={{ overflowY: "auto" }}>
      <div data-testid="viewport" style={{ overflowY: "auto" }}><TestPaginatedList /></div>
    </div>);
    const viewport = screen.getByTestId("viewport");
    const outer = screen.getByTestId("outer");
    outer.scrollTop = 90;
    viewport.scrollTop = 600;
    Object.defineProperty(viewport, "clientTop", { value: 2 });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 100, 400, 300));
    vi.spyOn(screen.getByRole("list"), "getBoundingClientRect").mockImplementation(() =>
      new DOMRect(0, 222 - viewport.scrollTop, 400, 500));
    const next = screen.getByRole("button", { name: "Next Test rows page" });
    next.focus();
    expect(viewport.scrollTop).toBe(600);
    fireEvent.click(next);
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(viewport.scrollTop).toBe(120);
    expect(outer.scrollTop).toBe(90);
    expect(next).toHaveFocus();
    viewport.scrollTop = 450;
    fireEvent.click(screen.getByRole("button", { name: "Previous Test rows page" }));
    expect(viewport.scrollTop).toBe(120);
    viewport.scrollTop = 500;
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "10" } });
    expect(viewport.scrollTop).toBe(120);
    view.unmount();
  });

  it("scrolls document-backed lists on page changes but not on initial render or unchanged pages", () => {
    const scrollingElement = document.createElement("div");
    scrollingElement.scrollTop = 700;
    const original = Object.getOwnPropertyDescriptor(document, "scrollingElement");
    Object.defineProperty(document, "scrollingElement", { configurable: true, value: scrollingElement });
    try {
      render(<TestPaginatedList />);
      expect(scrollingElement.scrollTop).toBe(700);
      vi.spyOn(screen.getByRole("list"), "getBoundingClientRect").mockImplementation(() =>
        new DOMRect(0, 160 - scrollingElement.scrollTop, 400, 500));
      fireEvent.click(screen.getByRole("button", { name: "Previous Test rows page" }));
      expect(scrollingElement.scrollTop).toBe(700);
      fireEvent.click(screen.getByRole("button", { name: "Next Test rows page" }));
      expect(scrollingElement.scrollTop).toBe(160);
    } finally {
      if (original) Object.defineProperty(document, "scrollingElement", original);
      else Reflect.deleteProperty(document, "scrollingElement");
    }
  });
});
