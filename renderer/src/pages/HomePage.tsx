import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCreators } from "../hooks/use-creators";

export function HomePage() {
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
          <h1 className="section-title">StageDock dashboard</h1>
          <p className="section-description">
            Quick overview of your creators and saved layouts. Jump to each
            feature using the shortcuts on the right.
          </p>
        </div>
        <div className="metric-grid">
          <div className="metric-card">
            <span className="metric-label">Creators</span>
            <p className="metric-value">{creators.length}</p>
            <p className="metric-caption">Registered creators</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Live now</span>
            <p className="metric-value">{liveCount}</p>
            <p className="metric-caption">Currently online</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="section-heading">
          <h2 className="section-title-small">Quick actions</h2>
          <p className="section-description">
            Frequent entry points to manage your multi-stream workflow.
          </p>
        </div>
        <div className="action-list">
          <Link to="/favorites" className="action-link">
            Manage creators
          </Link>
          <Link to="/multiview" className="action-link">
            Build or restore a multi-view layout
          </Link>
          <Link to="/settings" className="action-link">
            Configure notifications and updates
          </Link>
        </div>
      </div>
    </div>
  );
}
