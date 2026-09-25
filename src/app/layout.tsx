import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Be_Vietnam_Pro } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { THEME_SCRIPT } from "@/components/theme";
import "./globals.css";

// Noi dung: Be Vietnam Pro (thiet ke cho dau tieng Viet). Tieu de: Barlow Condensed, gan net chu trong logo.
const sans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});
const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Siêu Thị Úc", template: "%s | Siêu Thị Úc" },
  description: "Quản lý bán hàng, kho, công nợ và lãi lỗ cửa hàng",
  applicationName: "Siêu Thị Úc",
  appleWebApp: { capable: true, title: "Siêu Thị Úc", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#324ca0" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1424" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
