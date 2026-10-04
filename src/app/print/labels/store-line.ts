// Dong cuoi tem: ten cua hang + hotline
export function storeLine(store: { name: string; phone: string | null } | null) {
  return store ? [store.name, store.phone].filter(Boolean).join(" - ") : "";
}

