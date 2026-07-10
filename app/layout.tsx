import type { Metadata, Viewport } from "next";
import Provider from "./Provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "일어나보니 대한민국 취준생",
  applicationName: "일어나보니 대한민국 취준생",
  description: "선택으로 졸업과 취업의 결말을 만드는 문학형 커리어 텍스트 어드벤처.",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: "취준생게임",
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
