"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface MixerChannel {
  url: string;
  label: string;
  volume: number;
  muted: boolean;
  solo: boolean;
}

function deriveLabel(url: string, index: number) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");
    return `${host} #${index + 1}`;
  } catch {
    return `Stream #${index + 1}`;
  }
}

export default function MixerPage() {
  const [channels, setChannels] = useState<MixerChannel[]>([]);

  const activeSolo = useMemo(() => channels.find((channel) => channel.solo), [channels]);

  useEffect(() => {
    const handler = (event: Event) => {
      const urls = (event as CustomEvent<{ urls?: string[] }>).detail?.urls ?? [];
      setChannels((prev) => {
        if (urls.length === 0) {
          return [];
        }

        const next: MixerChannel[] = urls.map((url, index) => {
          const existing = prev.find((channel) => channel.url === url);
          return (
            existing ?? {
              url,
              label: deriveLabel(url, index),
              volume: 75,
              muted: false,
              solo: false
            }
          );
        });

        return next;
      });
    };

    document.addEventListener("stagedock:multiview-streams", handler as EventListener);
    return () => document.removeEventListener("stagedock:multiview-streams", handler as EventListener);
  }, []);

  const updateChannel = useCallback((url: string, updater: (channel: MixerChannel) => MixerChannel) => {
    setChannels((prev) => prev.map((channel) => (channel.url === url ? updater(channel) : channel)));
  }, []);

  const handleVolumeChange = useCallback(
    (url: string, volume: number) => {
      updateChannel(url, (channel) => ({ ...channel, volume, muted: volume === 0 }));
    },
    [updateChannel]
  );

  const handleMuteToggle = useCallback(
    (url: string) => {
      updateChannel(url, (channel) => ({ ...channel, muted: !channel.muted }));
    },
    [updateChannel]
  );

  const handleSoloToggle = useCallback((url: string) => {
    setChannels((prev) => {
      const isActivating = !prev.find((channel) => channel.url === url)?.solo;
      return prev.map((channel) => {
        if (channel.url === url) {
          return { ...channel, solo: isActivating };
        }
        return { ...channel, solo: isActivating ? false : channel.solo };
      });
    });
  }, []);

  return (
    <div className="section">
      <div className="section-heading">
        <h1 className="section-title">Audio mixer</h1>
        <p className="section-description">
          Balance the volume of each active frame. A future WASAPI or PortAudio backend will connect to these controls.
        </p>
      </div>

      {channels.length === 0 ? (
        <div className="empty-state">Load URLs in the multi-view screen to populate channels here.</div>
      ) : (
        <div className="panel" style={{ gap: 20 }}>
          {channels.map((channel, index) => {
            const effectiveVolume = activeSolo && !channel.solo ? 0 : channel.muted ? 0 : channel.volume;
            return (
              <div key={channel.url} className="panel" style={{ gap: 14 }}>
                <div className="form-actions">
                  <div>
                    <p className="metric-label" style={{ letterSpacing: "0.1em" }}>Channel {index + 1}</p>
                    <h3 style={{ margin: "4px 0 0" }}>{channel.label}</h3>
                    <p className="misc-note">Effective volume: {effectiveVolume}%</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" className="button button-outline" onClick={() => handleMuteToggle(channel.url)}>
                      {channel.muted ? "Unmute" : "Mute"}
                    </button>
                    <button type="button" className="button button-primary" onClick={() => handleSoloToggle(channel.url)}>
                      {channel.solo ? "Solo active" : "Solo"}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={channel.volume}
                    onChange={(event) => handleVolumeChange(channel.url, Number(event.target.value))}
                    className="range-input"
                  />
                  <span className="misc-note" style={{ minWidth: 42, textAlign: "right" }}>{channel.volume}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="panel panel-muted">
        <h2 className="section-title-small">Roadmap</h2>
        <ul className="misc-note" style={{ listStyle: "disc", paddingLeft: 20, margin: "8px 0 0" }}>
          <li>Connect to WASAPI or PortAudio backend for real fades</li>
          <li>Auto duck non-active channels when solo is enabled</li>
          <li>Keyboard shortcuts for focus and volume bumps</li>
        </ul>
      </div>
    </div>
  );
}
