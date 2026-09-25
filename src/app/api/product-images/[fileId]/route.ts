import { downloadFromDrive, driveConfigured } from "@/lib/google-drive";

// Anh san pham tu Google Drive. Middleware da chan nguoi chua dang nhap.
// File tren Drive khong bao gio bi ghi de nen cache lau dai.
export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  if (!driveConfigured() || !/^[\w-]{10,100}$/.test(fileId)) return new Response(null, { status: 404 });
  const res = await downloadFromDrive(fileId);
  if (!res.ok || !res.body) return new Response(null, { status: res.status === 404 ? 404 : 502 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
