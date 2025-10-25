import React from "react";
import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/favorites", label: "Creators" },
  { href: "/multiview", label: "Multi-view" },
  { href: "/settings", label: "Settings" },
] as const;

export function SidebarNavigation() {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-badge">StageDock</span>
        <h1 className="sidebar-title">Control Center</h1>
      </div>
      <nav>
        <ul className="nav-list">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  className={clsx("nav-link", isActive && "is-active")}
                  to={link.href}
                >
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
