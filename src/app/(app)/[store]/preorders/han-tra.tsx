import { diffDays } from "@/lib/dates";
import { ChipSac } from "@/components/ui/chip";

// Han tra: tre hen (do), hom nay (vang); chi tinh cho don chua giao/huy
export function HanTra({ due, status, today }: { due: string; status: string; today: string }) {
  const d = diffDays(today, due);
  if ((status !== "open" && status !== "arrived") || d > 0) return null;
  return <ChipSac sac={d < 0 ? "red" : "amber"}>{d < 0 ? `Trễ hẹn ${-d} ngày` : "Hẹn trả hôm nay"}</ChipSac>;
}
