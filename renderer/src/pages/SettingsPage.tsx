import React, { useEffect, useState } from "react";
import { useSetSetting, useSetting } from "../hooks/use-settings";
import { useI18n } from "../hooks/use-i18n";
import { getStageDock, isStageDockAvailable } from "../lib/stagedock";

type Language = "ja" | "en";

interface SilentHours {
  start: string;
  end: string;
}

export function SettingsPage() {
  const { t } = useI18n();
  const { data: silentHours } = useSetting<SilentHours>(
    "notifications.silentHours"
  );
  const { data: autoUpdateEnabled } = useSetting<boolean>("updates.auto", true);
  const { data: language } = useSetting<Language>("ui.language", "ja");
  const setSetting = useSetSetting();

  const [localSilentHours, setLocalSilentHours] = useState<SilentHours>({
    start: "00:00",
    end: "08:00",
  });
  const [localAutoUpdate, setLocalAutoUpdate] = useState(true);
  const [localLanguage, setLocalLanguage] = useState<Language>("ja");
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{
    percent: number;
    transferred: number;
    total: number;
  } | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string>("");

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

  useEffect(() => {
    if (language) {
      setLocalLanguage(language);
    }
  }, [language]);

  // アプリバージョンを取得
  useEffect(() => {
    const fetchVersion = async () => {
      if (isStageDockAvailable()) {
        try {
          const version = await getStageDock().app.getVersion();
          setAppVersion(version);
        } catch (error) {
          console.error("Failed to get app version:", error);
        }
      }
    };
    fetchVersion();
  }, []);

  // アップデートイベントリスナーを設定
  useEffect(() => {
    if (!isStageDockAvailable()) return;

    const handleUpdateProgress = (progress: {
      percent: number;
      transferred: number;
      total: number;
    }) => {
      setUpdateProgress(progress);
    };

    const handleUpdateStatus = (status: {
      isUpdating: boolean;
      message: string;
    }) => {
      setIsUpdating(status.isUpdating);
      setUpdateMessage(status.message);
      if (!status.isUpdating) {
        setUpdateProgress(null);
      }
    };

    getStageDock().update.onProgress(handleUpdateProgress);
    getStageDock().update.onStatus(handleUpdateStatus);

    return () => {
      // クリーンアップは不要（イベントリスナーは自動で削除される）
    };
  }, []);

  const handleSilentHoursChange =
    (field: keyof SilentHours) => (value: string) => {
      const next = { ...localSilentHours, [field]: value } as SilentHours;
      setLocalSilentHours(next);
      void setSetting.mutateAsync({
        key: "notifications.silentHours",
        value: next,
      });
    };

  const handleAutoUpdateToggle = (checked: boolean) => {
    setLocalAutoUpdate(checked);
    void setSetting.mutateAsync({ key: "updates.auto", value: checked });
  };

  const handleCheckUpdate = async () => {
    if (!isStageDockAvailable()) return;

    setIsCheckingUpdate(true);
    try {
      const result = await getStageDock().update.check();
      console.log("Update check result:", {
        hasUpdateInfo: !!result?.updateInfo,
        version: result?.updateInfo?.version,
        releaseName: result?.updateInfo?.releaseName,
        hasDownloadPromise: !!result?.downloadPromise,
        hasCancellationToken: !!result?.cancellationToken,
      });
      // アップデートが利用可能な場合は通知が自動で表示される
    } catch (error) {
      console.error("Update check failed:", error);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleLanguageChange = async (newLanguage: Language) => {
    if (isSavingLanguage) return; // 保存中は無視

    setIsSavingLanguage(true);
    setLocalLanguage(newLanguage);
    try {
      await setSetting.mutateAsync({ key: "ui.language", value: newLanguage });
      console.log(`Language setting saved to DB: ${newLanguage}`);
    } catch (error) {
      console.error("Failed to save language setting:", error);
      // エラーが発生した場合は元の言語に戻す
      setLocalLanguage(language || "ja");
    } finally {
      setIsSavingLanguage(false);
    }
  };

  return (
    <div className="section">
      <div className="section-heading">
        <h1 className="section-title">{t("settings.title")}</h1>
        <p className="section-description">{t("settings.description")}</p>
      </div>

      <div className="panel">
        <h2 className="section-title-small">{t("settings.quietHours")}</h2>
        <p className="misc-note">{t("settings.quietHoursDescription")}</p>
        <div className="form-grid" style={{ maxWidth: 420 }}>
          <div>
            <label className="label" htmlFor="quiet-from">
              {t("settings.from")}
            </label>
            <input
              id="quiet-from"
              type="time"
              value={localSilentHours.start}
              onChange={(event) =>
                handleSilentHoursChange("start")(event.target.value)
              }
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="quiet-to">
              {t("settings.to")}
            </label>
            <input
              id="quiet-to"
              type="time"
              value={localSilentHours.end}
              onChange={(event) =>
                handleSilentHoursChange("end")(event.target.value)
              }
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="section-title-small">{t("settings.autoUpdates")}</h2>
        <div className="form-actions">
          <p className="section-description" style={{ margin: 0 }}>
            {t("settings.autoUpdatesDescription")}
          </p>
          <label
            className="label"
            style={{ gap: 12, textTransform: "none", letterSpacing: 0 }}
          >
            <span>{t("settings.autoUpdate")}</span>
            <input
              type="checkbox"
              checked={localAutoUpdate}
              onChange={(event) => handleAutoUpdateToggle(event.target.checked)}
              className="checkbox"
            />
          </label>
        </div>
      </div>

      {/* アップデート進捗表示 */}
      {isUpdating && (
        <div
          className="panel"
          style={{ backgroundColor: "#f0f9ff", border: "1px solid #0ea5e9" }}
        >
          <h2 className="section-title-small" style={{ color: "#0369a1" }}>
            {t("settings.updating")}
          </h2>
          <p className="misc-note" style={{ color: "#0369a1" }}>
            {updateMessage}
          </p>
          {updateProgress && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  width: "100%",
                  height: 8,
                  backgroundColor: "#e0f2fe",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${updateProgress.percent}%`,
                    height: "100%",
                    backgroundColor: "#0ea5e9",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  fontSize: "0.875rem",
                  color: "#0369a1",
                }}
              >
                <span>{Math.round(updateProgress.percent)}%</span>
                <span>
                  {(updateProgress.transferred / 1024 / 1024).toFixed(1)}MB /
                  {(updateProgress.total / 1024 / 1024).toFixed(1)}MB
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <h2 className="section-title-small">{t("settings.language")}</h2>
        <p className="misc-note">{t("settings.languageDescription")}</p>
        <div className="form-actions">
          <div
            role="group"
            aria-label="Select language"
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className={`button ${
                localLanguage === "ja" ? "button-primary" : "button-outline"
              }`}
              onClick={() => handleLanguageChange("ja")}
              aria-pressed={localLanguage === "ja"}
              disabled={isSavingLanguage}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                opacity: isSavingLanguage ? 0.6 : 1,
              }}
            >
              <span>🇯🇵</span>
              <span>{t("settings.japanese")}</span>
              {isSavingLanguage && localLanguage === "ja" && <span>...</span>}
            </button>
            <button
              type="button"
              className={`button ${
                localLanguage === "en" ? "button-primary" : "button-outline"
              }`}
              onClick={() => handleLanguageChange("en")}
              aria-pressed={localLanguage === "en"}
              disabled={isSavingLanguage}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                opacity: isSavingLanguage ? 0.6 : 1,
              }}
            >
              <span>🇺🇸</span>
              <span>{t("settings.english")}</span>
              {isSavingLanguage && localLanguage === "en" && <span>...</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="section-title-small">{t("settings.appInfo")}</h2>
        <div className="form-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <p className="misc-note" style={{ margin: 0 }}>
                {t("settings.version")}: {appVersion || t("settings.loading")}
              </p>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              style={{
                opacity: isCheckingUpdate ? 0.6 : 1,
              }}
            >
              {isCheckingUpdate
                ? t("settings.checkingUpdate")
                : t("settings.checkUpdate")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
