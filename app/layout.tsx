import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "College Career Sim",
  description: "Korean literary college career text-adventure simulation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
