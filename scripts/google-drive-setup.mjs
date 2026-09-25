// Ket noi Google Drive cua chu cua hang (chay mot lan tren may).
// Can GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (OAuth client loai Desktop app) trong .env.local.
// Script mo trang dang nhap Google, lay refresh token, tao thu muc "sieuthiuc"
// roi ghi GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID vao .env.local.
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

const ENV_FILE = ".env.local";
config({ path: ENV_FILE, quiet: true });
const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong .env.local");
  process.exit(1);
}

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const c = url.searchParams.get("code");
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(c ? "Đã kết nối. Quay lại cửa sổ dòng lệnh." : `Lỗi: ${url.searchParams.get("error")}`);
    server.close();
    if (c) resolve(c);
    else reject(new Error(url.searchParams.get("error") ?? "không có mã"));
  });
  server.listen(0, "127.0.0.1", () => {
    const redirect = `http://127.0.0.1:${server.address().port}`;
    process.env.REDIRECT = redirect;
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.search = new URLSearchParams({
      client_id: id,
      redirect_uri: redirect,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file",
      access_type: "offline",
      prompt: "consent",
    }).toString();
    console.log(`Mở link sau và đăng nhập bằng tài khoản Google sẽ lưu ảnh:\n\n${auth}\n`);
    if (process.platform === "win32") exec(`start "" "${auth}"`);
  });
});

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  body: new URLSearchParams({
    code,
    client_id: id,
    client_secret: secret,
    redirect_uri: process.env.REDIRECT,
    grant_type: "authorization_code",
  }),
});
const token = await tokenRes.json();
if (!token.refresh_token) {
  console.error("Không nhận được refresh token:", token);
  process.exit(1);
}
const auth = { Authorization: `Bearer ${token.access_token}` };

// Dung lai thu muc cu neu da chay truoc do (drive.file chi thay thu muc do app tao)
const q = "name = 'sieuthiuc' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
const found = await (await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, { headers: auth })).json();
let folderId = found.files?.[0]?.id;
if (!folderId) {
  const created = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "sieuthiuc", mimeType: "application/vnd.google-apps.folder" }),
  });
  folderId = (await created.json()).id;
}
if (!folderId) {
  console.error("Không tạo được thư mục sieuthiuc");
  process.exit(1);
}

let env = readFileSync(ENV_FILE, "utf8");
for (const [k, v] of Object.entries({ GOOGLE_REFRESH_TOKEN: token.refresh_token, GOOGLE_DRIVE_FOLDER_ID: folderId })) {
  const line = `${k}=${v}`;
  env = new RegExp(`^${k}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), line) : `${env.trimEnd()}\n${line}\n`;
}
writeFileSync(ENV_FILE, env);
console.log(`Xong. Thư mục sieuthiuc: https://drive.google.com/drive/folders/${folderId}`);
console.log("Đã ghi GOOGLE_REFRESH_TOKEN và GOOGLE_DRIVE_FOLDER_ID vào .env.local");
