import type { Metadata } from "next";
// import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "../styles/globals.css";
import { ConditionalLayout } from "../components/conditional-layout";

// const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "StageDock",
  description: "Multi-stream viewing for creators and viewers on Windows.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="app-body">
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
