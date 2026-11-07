import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination, usePagination } from "./Pagination";

function TestPaginatedList() {
  const rows = usePagination(Array.from({ length: 12 }, (_, index) => index + 1));
  return (
    <>
      <ul>
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
});
