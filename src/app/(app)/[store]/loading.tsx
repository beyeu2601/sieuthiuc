import { Skeleton } from "@/components/ui/skeleton";

// Khung dashboard dung hinh trang that: loi chao, khoi Ban hang + 3 loi tat,
// hang the KPI, khung "Can chu y". Ke toan khong co khoi Ban hang nhung loading
// khong biet vai tro, van ve de khung khong nhay khi du lieu toi.
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 sm:block sm:p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-24 sm:mt-2 sm:h-7 sm:w-36" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-4 lg:p-5">
        <Skeleton className="mb-3 h-7 w-36" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
