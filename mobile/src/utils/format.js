const INT_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return INT_FORMATTER.format(Math.round(n));
}
