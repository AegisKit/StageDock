"use client";

import { useEffect, useState } from "react";
import { useSetSetting, useSetting } from "../../hooks/use-settings";

interface SilentHours {
  start: string;
  end: string;
}

export default function SettingsPage() {
  const { data: silentHours } = useSetting<SilentHours>("notifications.silentHours");
  const { data: autoUpdateEnabled } = useSetting<boolean>("updates.auto", true);
  const setSetting = useSetSetting();

  const [localSilentHours, setLocalSilentHours] = useState<SilentHours>({ start: "00:00", end: "08:00" });
  const [localAutoUpdate, setLocalAutoUpdate] = useState(true);

  useEffect(() => {
    if (silentHours) {
      setLocalSilentHours(silentHours);
    }
  }, [silentHours]);

  useEffect(() => {
    if (typeof autoUpdateEnabled === "boolean") {
      setLocalAutoUpdate(autoUpdateEnabled);
    }
  }, [autoUpdateEnabled]);

  const handleSilentHoursChange = (field: keyof SilentHours) => (value: string) => {
    const next = { ...localSilentHours, [field]: value } as SilentHours;
    setLocalSilentHours(next);
    void setSetting.mutateAsync({ key: "notifications.silentHours", value: next });
  };

  const handleAutoUpdateToggle = (checked: boolean) => {
    setLocalAutoUpdate(checked);
    void setSetting.mutateAsync({ key: "updates.auto", value: checked });
  };

  return (
    <div className="section">
      <div className="section-heading">
        <h1 className="section-title">Settings</h1>
        <p className="section-description">
          Manage notification windows, auto updates, and integration placeholders.
        </p>
      </div>

      <div className="panel">
        <h2 className="section-title-small">Quiet hours</h2>
        <p className="misc-note">Suppress start notifications during the selected window, using 24-hour format.</p>
        <div className="form-grid" style={{ maxWidth: 420 }}>
          <div>
            <label className="label" htmlFor="quiet-from">
              From
            </label>
            <input
              id="quiet-from"
              type="time"
              value={localSilentHours.start}
              onChange={(event) => handleSilentHoursChange("start")(event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="quiet-to">
              To
            </label>
            <input
              id="quiet-to"
              type="time"
              value={localSilentHours.end}
              onChange={(event) => handleSilentHoursChange("end")(event.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="section-title-small">Auto updates</h2>
        <div className="form-actions">
          <p className="section-description" style={{ margin: 0 }}>
            Check for StageDock releases automatically and install them in the background.
          </p>
          <label className="label" style={{ gap: 12, textTransform: "none", letterSpacing: 0 }}>
            <span>Auto update</span>
            <input
              type="checkbox"
              checked={localAutoUpdate}
              onChange={(event) => handleAutoUpdateToggle(event.target.checked)}
              className="checkbox"
            />
          </label>
        </div>
      </div>

      <div className="panel panel-muted">
        <h2 className="section-title-small">API keys</h2>
        <p className="misc-note">
          Store Twitch and YouTube credentials via environment variables or the system credential manager. A dedicated UI is planned.
        </p>
      </div>
    </div>
  );
}
