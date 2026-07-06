import type { Metadata } from "next";
import Provider from "./Provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "일어나보니 대한민국 취준생",
  description: "문학형 커리어 텍스트 어드벤처.",
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
