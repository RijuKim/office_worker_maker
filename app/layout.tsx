import type { Metadata, Viewport } from "next";
import Provider from "./Provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "일어나보니 대한민국 취준생",
  applicationName: "일어나보니 대한민국 취준생",
  description: "스펙, 멘탈, 통장잔고까지 관리해야 하는 가상 취준 생활 시뮬레이션.",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: "취준 시뮬레이션",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#17263f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
