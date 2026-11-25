/**
 * Copies each column header's text onto the cells below it as `data-label`.
 * The mobile CSS (styles/mobile.css, section 5) turns every `.hc-table` row
 * into a stacked card and shows that label in front of each value, so no table
 * needs a minimum width or a horizontal scrollbar on a phone.
 *
 * Runs once at start-up and again whenever the DOM changes (tables are
 * rendered after data loads); the work is batched into one animation frame.
 */
function labelTables(root = document) {
  root.querySelectorAll("table.hc-table").forEach((table) => {
    const headRow = table.querySelector("thead tr:last-child");
    if (!headRow) return;

    const heads = [];
    headRow.querySelectorAll("th").forEach((th) => {
      const text = th.textContent.replace(/\s+/g, " ").trim();
      const span = th.colSpan || 1;
      for (let i = 0; i < span; i += 1) heads.push(text);
    });

    table.querySelectorAll("tbody tr, tfoot tr").forEach((row) => {
      let col = 0;
      Array.from(row.children).forEach((cell) => {
        const span = cell.colSpan || 1;
        // a cell that spans several columns (empty-state row, totals) gets no label
        const label = span === 1 ? heads[col] || "" : "";
        if (cell.getAttribute("data-label") !== label) {
          if (label) cell.setAttribute("data-label", label);
          else cell.removeAttribute("data-label");
        }
        col += span;
      });
    });
  });
}

export function initTableLabels() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      labelTables();
    });
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}
