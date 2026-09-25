import type { SessionContext, StoreLite } from "@/lib/auth";
import { presetPeriod, type Period } from "@/lib/dates";

export type ReportSP = { preset?: string; from?: string; to?: string; channel?: string; all?: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function resolveReport(ctx: SessionContext, store: StoreLite, sp: ReportSP) {
  const period: Period =
    sp.from && sp.to && ISO.test(sp.from) && ISO.test(sp.to) && sp.from <= sp.to
      ? { from: sp.from, to: sp.to }
      : presetPeriod(sp.preset ?? "month");
  const preset = sp.from && sp.to ? undefined : (sp.preset ?? "month");
  const canAll = ctx.stores.length > 1;
  const allStores = canAll && sp.all === "1";
  const storeIds = allStores ? ctx.stores.map((s) => s.id) : [store.id];
  const channel = ["pos", "shopee", "facebook", "other"].includes(sp.channel ?? "") ? sp.channel : undefined;
  return { period, preset, canAll, allStores, storeIds, channel };
}
