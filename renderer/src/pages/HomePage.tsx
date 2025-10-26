import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCreators } from "../hooks/use-creators";
import { useI18n } from "../hooks/use-i18n";

export function HomePage() {
  const { t } = useI18n();
  const creatorsQuery = useCreators();

  const creators = creatorsQuery.data ?? [];

  const liveCount = useMemo(
    () => creators.filter((creator) => creator.liveStatus?.isLive).length,
    [creators]
  );

  return (
    <div className="section">
      <div className="panel">
        <div className="section-heading">
          <h1 className="section-title">{t("dashboard.title")}</h1>
          <p className="section-description">{t("dashboard.description")}</p>
        </div>
        <div className="metric-grid">
          <div className="metric-card">
            <span className="metric-label">{t("creators.title")}</span>
            <p className="metric-value">{creators.length}</p>
            <p className="metric-caption">
              {t("dashboard.registeredCreators")}
            </p>
          </div>
          <div className="metric-card">
            <span className="metric-label">{t("dashboard.liveNow")}</span>
            <p className="metric-value">{liveCount}</p>
            <p className="metric-caption">{t("dashboard.currentlyOnline")}</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="section-heading">
          <h2 className="section-title-small">{t("dashboard.quickActions")}</h2>
          <p className="section-description">
            {t("dashboard.quickActionsDescription")}
          </p>
        </div>
        <div className="action-list">
          <Link to="/favorites" className="action-link">
            {t("dashboard.manageCreators")}
          </Link>
          <Link to="/multiview" className="action-link">
            {t("dashboard.buildMultiview")}
          </Link>
          <Link to="/settings" className="action-link">
            {t("dashboard.configureSettings")}
          </Link>
        </div>
      </div>
    </div>
  );
}
