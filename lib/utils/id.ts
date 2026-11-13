/** Prefixed, collision-resistant local ids (e.g. `tx_4f9c…`). */
export function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `${prefix}_${random.slice(0, 20)}`;
}
