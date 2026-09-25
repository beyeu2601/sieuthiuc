import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // anh san pham gui qua Server Action (da thu nho o trinh duyet, thuong duoi 1MB)
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
