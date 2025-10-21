"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { SidebarNavigation } from "./navigation/sidebar";
import { ReactQueryProvider } from "../providers/state/react-query-provider";

interface ConditionalLayoutProps {
  children: ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();

  // マルチビューウィンドウの場合はサイドバーを表示しない
  const isMultiviewWindow = pathname?.includes("/multiview-window") || false;

  if (isMultiviewWindow) {
    return (
      <div className="multiview-shell">
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <SidebarNavigation />
      <main className="app-content">
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </main>
    </div>
  );
}
