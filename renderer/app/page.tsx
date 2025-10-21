"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCreators } from "../hooks/use-creators";

export default function HomePage() {
  const creatorsQuery = useCreators();

  const creators = creatorsQuery.data ?? [];

  const liveCount = useMemo(
    () => creators.filter((creator) => creator.liveStatus?.isLive).length,
    [creators]
  );

  // readyがfalseでもデータを表示する（初期データまたはキャッシュされたデータ）

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
          <Link href="/favorites" className="action-link">
            Manage creators
          </Link>
          <Link href="/multiview" className="action-link">
            Build or restore a multi-view layout
          </Link>
          <Link href="/settings" className="action-link">
            Configure notifications and updates
          </Link>
        </div>
      </div>
    </div>
  );
}
