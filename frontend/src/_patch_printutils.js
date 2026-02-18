const fs = require('fs');
const p = 'D:/POS_NEW/frontend/src/printUtils.js';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('print-active')) {
  c = c.replace(
    '  document.body.classList.add(mode === "a4" ? "receipt-print-a4" : "receipt-print-3inch");',
    '  document.body.classList.add(mode === "a4" ? "receipt-print-a4" : "receipt-print-3inch");\n\n  const printAreas = Array.from(document.querySelectorAll("#print-area"));\n  printAreas.forEach((el) => el.classList.remove("print-active"));\n  const activePrintArea = printAreas.find((el) => el.offsetParent !== null) || printAreas[0];\n  if (activePrintArea) activePrintArea.classList.add("print-active");'
  );

  c = c.replace(
    '  document.body.classList.remove("receipt-print-3inch", "receipt-print-a4");',
    '  document.body.classList.remove("receipt-print-3inch", "receipt-print-a4");\n\n  const printAreas = Array.from(document.querySelectorAll("#print-area"));\n  printAreas.forEach((el) => el.classList.remove("print-active"));'
  );
}
fs.writeFileSync(p, c, 'ascii');
console.log('ok');
