export function applyReceiptPrint(mode = "3inch") {
  if (typeof document === "undefined") return;

  document.body.classList.add("receipt-print");
  document.body.classList.remove("receipt-print-3inch", "receipt-print-a4");

  document.body.classList.add(mode === "a4" ? "receipt-print-a4" : "receipt-print-3inch");

  const printAreas = Array.from(document.querySelectorAll("#print-area"));
  printAreas.forEach((el) => el.classList.remove("print-active"));
  const activePrintArea = printAreas.find((el) => el.offsetParent !== null) || printAreas[0];
  if (activePrintArea) activePrintArea.classList.add("print-active");

  const existingClone = document.getElementById("receipt-print-clone");
  if (existingClone && existingClone.parentNode) {
    existingClone.parentNode.removeChild(existingClone);
  }
  if (activePrintArea) {
    const clone = activePrintArea.cloneNode(true);
    clone.id = "receipt-print-clone";
    clone.classList.add("print-active");
    document.body.appendChild(clone);
  }

  let style = document.getElementById("receipt-print-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "receipt-print-style";
    document.head.appendChild(style);
  }
  /* Chrome does not support @page size with "auto"; use fixed height so 104mm width is applied */
  style.textContent =
    mode === "a4"
      ? "@media print { @page { size: 210mm 297mm; margin: 0.4in; } }"
      : "@media print { @page { size: 104mm 297mm; margin: 0; } }";
}

export function cleanupReceiptPrint() {
  if (typeof document === "undefined") return;

  document.body.classList.remove("receipt-print");
  document.body.classList.remove("receipt-print-3inch", "receipt-print-a4");

  const style = document.getElementById("receipt-print-style");
  if (style && style.parentNode) {
    const printAreas = Array.from(document.querySelectorAll("#print-area"));
    printAreas.forEach((el) => el.classList.remove("print-active"));

    const clone = document.getElementById("receipt-print-clone");
    if (clone && clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }

    style.parentNode.removeChild(style);
  }
}



