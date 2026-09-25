import "server-only";

// Google Drive cua chu cua hang, quyen drive.file: app chi thay file do chinh app tao.
// Refresh token va thu muc "sieuthiuc" tao bang scripts/google-drive-setup.mjs.
const API = "https://www.googleapis.com/drive/v3";

let cached: { token: string; expires: number } | null = null;

export function driveConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

async function accessToken() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export async function uploadToDrive(name: string, file: Blob): Promise<string> {
  const meta = { name, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!] };
  const body = new FormData();
  body.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  body.append("file", file);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}` },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

// Bo vao thung rac (khoi phuc duoc trong 30 ngay) thay vi xoa han.
export async function trashOnDrive(fileId: string) {
  const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Drive trash ${res.status}: ${await res.text()}`);
}

export async function downloadFromDrive(fileId: string) {
  return fetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
}
