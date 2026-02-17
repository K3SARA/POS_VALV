const INT_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return INT_FORMATTER.format(Math.round(n));
}

export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return DECIMAL_FORMATTER.format(n);
}
