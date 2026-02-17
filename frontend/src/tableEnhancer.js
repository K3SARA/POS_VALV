const ENHANCED_TABLE_ATTR = "data-table-enhanced";
const SORTABLE_ATTR = "data-table-sortable";

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseSortableValue(text) {
  const raw = normalizeText(text);
  if (!raw) return { type: "text", value: "" };

  // Money/number support: "Rs 12,345.67", "1234", "-45"
  const numeric = raw.replace(/[^\d.-]/g, "");
  if (numeric && /^-?\d+(\.\d+)?$/.test(numeric)) {
    return { type: "number", value: Number(numeric) };
  }

  const time = Date.parse(raw);
  if (Number.isFinite(time)) {
    return { type: "date", value: time };
  }

  return { type: "text", value: raw.toLowerCase() };
}

function compareValues(a, b) {
  if (a.type === b.type) {
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    return 0;
  }

  // Prefer number/date sorting when mixed
  const rank = { number: 0, date: 1, text: 2 };
  return (rank[a.type] ?? 99) - (rank[b.type] ?? 99);
}

function applySort(table, columnIndex, direction) {
  const tbody = table.tBodies?.[0];
  if (!tbody) return;

  const rows = Array.from(tbody.rows || []);
  rows.sort((rowA, rowB) => {
    const cellA = rowA.cells?.[columnIndex];
    const cellB = rowB.cells?.[columnIndex];
    const valA = parseSortableValue(cellA?.innerText || "");
    const valB = parseSortableValue(cellB?.innerText || "");
    const base = compareValues(valA, valB);
    return direction === "asc" ? base : -base;
  });

  rows.forEach((row) => tbody.appendChild(row));
}

function setupHeaderSorting(table) {
  if (table.getAttribute(SORTABLE_ATTR) === "1") return;
  table.setAttribute(SORTABLE_ATTR, "1");

  const headerRow = table.tHead?.rows?.[0];
  if (!headerRow) return;

  const headers = Array.from(headerRow.cells || []);
  headers.forEach((th, index) => {
    th.classList.add("table-sortable-th");
    th.addEventListener("click", () => {
      const current = th.getAttribute("data-sort-dir");
      const next = current === "asc" ? "desc" : "asc";

      headers.forEach((h) => {
        h.removeAttribute("data-sort-dir");
      });
      th.setAttribute("data-sort-dir", next);

      applySort(table, index, next);
    });
  });
}

function parentAlreadyScrollWrap(table) {
  const parent = table.parentElement;
  if (!parent) return false;
  const style = window.getComputedStyle(parent);
  return style.overflowY === "auto" || style.overflowY === "scroll";
}

function setupRowLimitedScroll(table) {
  if (parentAlreadyScrollWrap(table)) return;

  const wrapper = document.createElement("div");
  wrapper.className = "table-enhanced-wrap";

  const parent = table.parentNode;
  if (!parent) return;
  parent.insertBefore(wrapper, table);
  wrapper.appendChild(table);

  const refreshHeight = () => {
    const head = table.tHead;
    const firstBodyRow = table.tBodies?.[0]?.rows?.[0];
    const headerHeight = head ? head.getBoundingClientRect().height : 44;
    const rowHeight = firstBodyRow ? firstBodyRow.getBoundingClientRect().height : 44;
    wrapper.style.maxHeight = `${Math.round(headerHeight + rowHeight * 5 + 2)}px`;
  };

  requestAnimationFrame(refreshHeight);
  window.addEventListener("resize", refreshHeight);
}

function shouldSkip(table) {
  if (!table) return true;
  if (table.getAttribute(ENHANCED_TABLE_ATTR) === "1") return true;
  if (table.closest(".receipt")) return true;
  if (table.closest("#print-area")) return true;
  if (table.closest("[data-no-table-enhance='1']")) return true;
  return false;
}

function enhanceTable(table) {
  if (shouldSkip(table)) return;
  table.setAttribute(ENHANCED_TABLE_ATTR, "1");
  setupHeaderSorting(table);
  setupRowLimitedScroll(table);
}

export function initTableEnhancer() {
  const enhanceAll = (root = document) => {
    const tables = root.querySelectorAll?.("table");
    if (!tables) return;
    tables.forEach(enhanceTable);
  };

  enhanceAll(document);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName === "TABLE") {
          enhanceTable(node);
          return;
        }
        enhanceAll(node);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
