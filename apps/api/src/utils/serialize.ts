export function dec(d: unknown): string {
  const n = typeof d === "number" ? d : Number(d);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}
