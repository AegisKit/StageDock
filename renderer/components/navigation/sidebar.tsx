"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/favorites", label: "Favorites" },
  { href: "/live", label: "Live Now" },
  { href: "/multiview", label: "Multi-view" },
  { href: "/settings", label: "Settings" }
] as const;

export function SidebarNavigation() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-badge">StageDock</span>
        <h1 className="sidebar-title">Control Center</h1>
      </div>
      <nav>
        <ul className="nav-list">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link className={clsx("nav-link", isActive && "is-active") } href={link.href}>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
