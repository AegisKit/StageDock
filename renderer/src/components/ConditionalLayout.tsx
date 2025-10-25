import React, { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { SidebarNavigation } from "./navigation/SidebarNavigation";

interface ConditionalLayoutProps {
  children: ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const location = useLocation();

  // マルチビューウィンドウの場合はサイドバーを表示しない
  const isMultiviewWindow = location.pathname.includes("/multiview-window");

  if (isMultiviewWindow) {
    return <div className="multiview-shell">{children}</div>;
  }

  return (
    <div className="app-shell">
      <SidebarNavigation />
      <main className="app-content">{children}</main>
    </div>
  );
}
