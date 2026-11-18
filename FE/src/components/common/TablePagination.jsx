import { useEffect, useState } from "react";
import useIsMobile from "../../hooks/useIsMobile";
import "./TablePagination.css";

export const PAGE_SIZE_DESKTOP = 10;
export const PAGE_SIZE_MOBILE = 5;

/** Page numbers to draw, with "…" gaps: 1 … 4 5 6 … 20 */
function buildPages(page, totalPages, siblings) {
  const keep = new Set([1, totalPages]);
  for (let p = page - siblings; p <= page + siblings; p += 1) {
    if (p >= 1 && p <= totalPages) keep.add(p);
  }
  const sorted = [...keep].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export function TablePagination({ total, page, pageSize, onPageChange, siblings = 1 }) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="hc-pagination">
      <div className="hc-pagination-info">
        Hiển thị kết quả từ <strong>{from}</strong> đến <strong>{to}</strong> trong tổng số <strong>{total}</strong>
      </div>
      {totalPages > 1 && (
        <nav className="hc-pagination-nav" aria-label="Phân trang">
          <button
            type="button"
            className="hc-pagination-btn"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Trang trước"
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          {buildPages(page, totalPages, siblings).map((p) =>
            typeof p === "string" ? (
              <span key={p} className="hc-pagination-gap">…</span>
            ) : (
              <button
                key={p}
                type="button"
                className={`hc-pagination-btn${p === page ? " is-active" : ""}`}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            className="hc-pagination-btn"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Trang sau"
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </nav>
      )}
    </div>
  );
}

/**
 * Wraps a table and paginates its rows (10 per page on desktop, 5 on mobile).
 *
 *   <Paginated items={rows}>
 *     {(pageRows, pager) => (
 *       <>
 *         <table>… {pageRows.map(...)} …</table>
 *         {pager}
 *       </>
 *     )}
 *   </Paginated>
 */
export default function Paginated({ items, children }) {
  const list = items || [];
  const isMobile = useIsMobile();
  const pageSize = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, totalPages);

  // a new filter / reload / breakpoint change starts again from page 1
  useEffect(() => {
    setPage(1);
  }, [list.length, pageSize]);

  const start = (current - 1) * pageSize;
  const pageItems = list.slice(start, start + pageSize);

  const pager = (
    <TablePagination
      total={list.length}
      page={current}
      pageSize={pageSize}
      onPageChange={(p) => setPage(Math.min(Math.max(1, p), totalPages))}
      siblings={isMobile ? 0 : 1}
    />
  );

  return children(pageItems, pager);
}
