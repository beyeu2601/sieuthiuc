import { Skeleton } from "@/components/ui/skeleton";

/**
 * Khung xam cua mot trang dang tai, dung cho cac file `loading.tsx`.
 *
 * Moi route trong app deu render dong va phai doi Supabase tra du lieu. Khong co
 * `loading.tsx` thi trinh duyet dung nguyen tren trang cu suot thoi gian do -
 * nguoi dung thay nhu bam khong an. Khung nay chi can dung hinh dang chung (tieu
 * de, hang the KPI, bang) de mat biet trang moi dang toi. Tren dien thoai bang
 * doi thanh may the.
 */
export function SkeletonTrang({ soThe = 0 }: { soThe?: number }) {
  return (
    <div aria-busy="true">
      <div className="mb-4">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2 h-3 w-72" />
      </div>

      {soThe > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          {Array.from({ length: soThe }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl sm:min-w-56 sm:flex-1" />
          ))}
        </div>
      ) : null}

      <Skeleton className="mb-3 h-9 w-full max-w-md" />

      <div className="hidden rounded-xl border bg-card md:block">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b p-3 last:border-b-0">
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>

      <div className="space-y-3 md:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
