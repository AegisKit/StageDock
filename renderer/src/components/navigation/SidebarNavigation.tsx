import React from "react";
import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useI18n } from "../../hooks/use-i18n";

const NAV_LINKS = [
  { href: "/", labelKey: "navigation.dashboard" },
  { href: "/favorites", labelKey: "navigation.creators" },
  { href: "/multiview", labelKey: "navigation.multiview" },
  { href: "/settings", labelKey: "navigation.settings" },
] as const;

export function SidebarNavigation() {
  const location = useLocation();
  const { t } = useI18n();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-badge">StageDock</span>
        <h1 className="sidebar-title">{t("navigation.controlCenter")}</h1>
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
                  {t(link.labelKey as any)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
