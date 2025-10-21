"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type {
  CreatorPlatform,
  CreatorWithStatus,
} from "../../../src/common/types.js";
import {
  useCreateCreator,
  useCreators,
  useDeleteCreator,
  useUpdateCreator,
} from "../../hooks/use-creators";
import { useStageDockReady } from "../../hooks/use-stagedock-ready";

const PLATFORM_LABELS: Record<CreatorPlatform, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
};

const DEFAULT_FORM_STATE = {
  platform: "twitch" as CreatorPlatform,
  channelInput: "",
  displayName: "",
  notifyEnabled: true,
};

type FormState = typeof DEFAULT_FORM_STATE;

function parseChannelInput(
  input: string
): Partial<{ platform: CreatorPlatform; channelId: string }> {
  const value = input.trim();
  if (!value) {
    return {};
  }

  const normalized = value.toLowerCase();

  if (normalized.includes("twitch.tv")) {
    const [, rest = ""] = normalized.split("twitch.tv/");
    const channelId = rest.split(/[/?]/)[0] ?? "";
    if (channelId) {
      return { platform: "twitch", channelId };
    }
  }

  if (
    normalized.includes("youtube.com") ||
    normalized.includes("youtu.be") ||
    normalized.startsWith("@")
  ) {
    if (normalized.startsWith("@")) {
      return { platform: "youtube", channelId: value.replace(/^@/, "") };
    }

    const parts = normalized.replace(/^https?:\/\//, "").split("/");
    const index = parts.findIndex((segment) =>
      ["channel", "c", "user", "@"].some((marker) => segment.startsWith(marker))
    );

    if (index >= 0) {
      const segment = parts[index];
      if (segment.startsWith("@")) {
        return { platform: "youtube", channelId: segment.replace("@", "") };
      }
      const channelId = parts[index + 1];
      if (channelId) {
        return { platform: "youtube", channelId };
      }
    }

    return { platform: "youtube", channelId: value };
  }

  return {};
}

function sortCreators(creators: CreatorWithStatus[]): CreatorWithStatus[] {
  return [...creators].sort((a, b) => {
    const aLive = a.liveStatus?.isLive ? 1 : 0;
    const bLive = b.liveStatus?.isLive ? 1 : 0;
    if (aLive !== bLive) {
      return bLive - aLive;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function FavoritesPage() {
  const ready = useStageDockReady();
  const creatorsQuery = useCreators();
  const createMutation = useCreateCreator();
  const updateMutation = useUpdateCreator();
  const deleteMutation = useDeleteCreator();

  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM_STATE);
  const [inputError, setInputError] = useState<string | null>(null);

  const creators = creatorsQuery.data ?? [];
  const sortedCreators = useMemo(() => sortCreators(creators), [creators]);
  const isSubmitting = createMutation.isPending;

  const handleInputChange =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormState((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleNotifyToggle = (creator: CreatorWithStatus) => {
    updateMutation.mutate({
      id: creator.id,
      notifyEnabled: !creator.notifyEnabled,
    });
  };

  const handleDelete = (creator: CreatorWithStatus) => {
    if (deleteMutation.isPending) {
      return;
    }
    deleteMutation.mutate(creator.id);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInputError(null);

    const detection = parseChannelInput(formState.channelInput);
    const platform = (detection.platform ??
      formState.platform) as CreatorPlatform;
    const channelId = detection.channelId ?? formState.channelInput.trim();

    if (!channelId) {
      setInputError("Enter a channel URL or ID.");
      return;
    }

    const displayName = formState.displayName.trim() || channelId;

    try {
      await createMutation.mutateAsync({
        platform,
        channelId,
        displayName,
        notifyEnabled: formState.notifyEnabled,
      });
      setFormState(DEFAULT_FORM_STATE);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add creator.";
      setInputError(message);
    }
  };

  if (creatorsQuery.error) {
    console.error("Failed to load creators", creatorsQuery.error);
  }

  if (!ready) {
    return (
      <div className="section">
        <div className="panel">
          <p className="misc-note">
            Connecting to StageDock background services...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="section-heading">
        <h1 className="section-title">Favorites</h1>
        <p className="section-description">
          Register Twitch or YouTube channels, manage notifications, and keep
          live creators at the top of your list.
        </p>
      </div>

      <form className="panel" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div>
            <label className="label" htmlFor="platform">
              Platform
            </label>
            <select
              id="platform"
              value={formState.platform}
              onChange={handleInputChange("platform")}
              className="select"
            >
              {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="channel">
              Channel URL or ID
            </label>
            <input
              id="channel"
              value={formState.channelInput}
              onChange={handleInputChange("channelInput")}
              placeholder="https://www.youtube.com/@example"
              className="input"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="displayName">
              Display name (optional)
            </label>
            <input
              id="displayName"
              value={formState.displayName}
              onChange={handleInputChange("displayName")}
              placeholder="Custom label"
              className="input"
            />
          </div>
        </div>

        <div className="form-actions">
          <label
            className="label"
            style={{ gap: 10, textTransform: "none", letterSpacing: 0 }}
          >
            <span>Send start notifications</span>
            <input
              type="checkbox"
              checked={formState.notifyEnabled}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  notifyEnabled: event.target.checked,
                }))
              }
              className="checkbox"
            />
          </label>
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Add to favorites"}
          </button>
        </div>

        {inputError && (
          <p className="button-danger" style={{ padding: "10px 14px" }}>
            {inputError}
          </p>
        )}
        {createMutation.isError && !inputError && (
          <p className="button-danger" style={{ padding: "10px 14px" }}>
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "Failed to add creator."}
          </p>
        )}
      </form>

      <div className="panel">
        <div
          className="section-heading"
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 className="section-title-small">Registered creators</h2>
          <span className="misc-note">
            {creatorsQuery.isLoading
              ? "Loading..."
              : `${creators.length} total`}
          </span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Display name</th>
                <th>Platform</th>
                <th>Channel ID</th>
                <th>Notification</th>
                <th>Status</th>
                <th aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {sortedCreators.length === 0 && !creatorsQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No favorites yet. Use the form above to add one.
                  </td>
                </tr>
              ) : (
                sortedCreators.map((creator) => (
                  <tr key={creator.id}>
                    <td>{creator.displayName}</td>
                    <td>{PLATFORM_LABELS[creator.platform]}</td>
                    <td>{creator.channelId}</td>
                    <td>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => handleNotifyToggle(creator)}
                      >
                        {creator.notifyEnabled ? "On" : "Off"}
                      </button>
                    </td>
                    <td>
                      {creator.liveStatus?.isLive ? (
                        <span className="badge badge-live">Live</span>
                      ) : (
                        <span className="badge badge-offline">Offline</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => handleDelete(creator)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
