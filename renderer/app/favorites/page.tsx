"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, JSX } from "react";
import type {
  CreatorPlatform,
  CreatorWithStatus,
  LiveStatus,
} from "../../../src/common/types.js";
import {
  useCreateCreator,
  useCreators,
  useDeleteCreator,
  useUpdateCreator,
} from "../../hooks/use-creators";
import { useStageDockReady } from "../../hooks/use-stagedock-ready";
import { getStageDock } from "../../lib/stagedock";

const PLATFORM_LABELS: Record<CreatorPlatform, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
};

const PLATFORM_ICONS: Record<CreatorPlatform, JSX.Element> = {
  twitch: (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      aria-hidden="true"
    >
      <path
        fill="#9146FF"
        d="M4 3h16v12l-4 4h-5l-3 3H6v-3H4V3Zm14 10V5H6v10h4v3l3-3h5Z"
      />
      <path fill="#fff" d="M13 8h2v4h-2zM9 8h2v4H9z" />
    </svg>
  ),
  youtube: (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      aria-hidden="true"
    >
      <path
        fill="#FF0000"
        d="M21.6 7.2c-.2-.9-.9-1.5-1.8-1.7C18 5.2 12 5.2 12 5.2s-6 0-7.8.3c-.9.2-1.6.8-1.8 1.7C2.1 9 2 10.9 2 10.9s-.1 1.9.4 3.7c.2.9.9 1.5 1.8 1.7 1.8.3 7.8.3 7.8.3s6 0 7.8-.3c.9-.2 1.6-.8 1.8-1.7.5-1.8.4-3.7.4-3.7s.1-1.9-.4-3.7Z"
      />
      <path fill="#fff" d="m10 8.8 4.8 2.1-4.8 2.1V8.8Z" />
    </svg>
  ),
};

const UNTAGGED_TAG_VALUE = "__untagged__";
const UNTAGGED_TAG_LABEL = "Untagged";

function parseTagsInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\\n]/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );
}

function formatTagsInput(tags: string[]): string {
  return tags.join(", ");
}

function getCreatorTags(creator: CreatorWithStatus): string[] {
  return Array.from(
    new Set(
      (creator.tags ?? [])
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );
}

const DEFAULT_FORM_STATE = {
  platform: "twitch" as CreatorPlatform,
  channelInput: "",
  displayName: "",
  notifyEnabled: true,
  tagsInput: "",
};

type FormState = typeof DEFAULT_FORM_STATE;

type EditFormState = {
  platform: CreatorPlatform;
  channelInput: string;
  displayName: string;
  notifyEnabled: boolean;
  tagsInput: string;
};

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

function buildStreamUrl(creator: CreatorWithStatus): string | null {
  const channelId = creator.channelId.trim();
  if (!channelId) {
    return null;
  }

  if (creator.platform === "twitch") {
    return `https://www.twitch.tv/${channelId}`;
  }

  if (creator.platform === "youtube") {
    if (channelId.startsWith("@")) {
      return `https://www.youtube.com/${channelId}/live`;
    }
    if (channelId.startsWith("UC") || channelId.startsWith("HC")) {
      return `https://www.youtube.com/channel/${channelId}/live`;
    }
    return `https://www.youtube.com/@${channelId}/live`;
  }

  return null;
}

export default function FavoritesPage() {
  const ready = useStageDockReady();
  const creatorsQuery = useCreators();
  const createMutation = useCreateCreator();
  const updateMutation = useUpdateCreator();
  const editMutation = useUpdateCreator();
  const deleteMutation = useDeleteCreator();

  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM_STATE);
  const [inputError, setInputError] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [editingCreator, setEditingCreator] =
    useState<CreatorWithStatus | null>(null);
  const [editState, setEditState] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const creators = creatorsQuery.data ?? [];
  const sortedCreators = useMemo(() => sortCreators(creators), [creators]);
  const onlineCreators = useMemo(
    () => sortedCreators.filter((creator) => creator.liveStatus?.isLive),
    [sortedCreators]
  );

  const tagGroups = useMemo(() => {
    const map = new Map<string, { label: string; creators: CreatorWithStatus[] }>();

    sortedCreators.forEach((creator) => {
      const tags = getCreatorTags(creator);
      if (tags.length === 0) {
        const entry =
          map.get(UNTAGGED_TAG_VALUE) ?? {
            label: UNTAGGED_TAG_LABEL,
            creators: [] as CreatorWithStatus[],
          };
        entry.creators.push(creator);
        map.set(UNTAGGED_TAG_VALUE, entry);
      } else {
        tags.forEach((tag) => {
          const entry =
            map.get(tag) ?? {
              label: tag,
              creators: [] as CreatorWithStatus[],
            };
          entry.creators.push(creator);
          map.set(tag, entry);
        });
      }
    });

    const entries = Array.from(map.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      creators: value.creators.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: "base",
        })
      ),
    }));

    entries.sort((a, b) => {
      if (a.key === UNTAGGED_TAG_VALUE) {
        return 1;
      }
      if (b.key === UNTAGGED_TAG_VALUE) {
        return -1;
      }
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });

    return entries;
  }, [sortedCreators]);

  const tagFilterOptions = useMemo(
    () =>
      tagGroups.map(({ key, label, creators }) => ({
        value: key,
        label,
        count: creators.length,
      })),
    [tagGroups]
  );

  useEffect(() => {
    if (
      activeTagFilter &&
      !tagFilterOptions.some((option) => option.value === activeTagFilter)
    ) {
      setActiveTagFilter(null);
    }
  }, [activeTagFilter, tagFilterOptions]);

  const filteredCreators = useMemo(() => {
    if (!activeTagFilter) {
      return sortedCreators;
    }
    if (activeTagFilter === UNTAGGED_TAG_VALUE) {
      return sortedCreators.filter(
        (creator) => getCreatorTags(creator).length === 0
      );
    }
    return sortedCreators.filter((creator) =>
      getCreatorTags(creator).includes(activeTagFilter)
    );
  }, [sortedCreators, activeTagFilter]);

  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  const selectedOnlineCreators = useMemo(
    () =>
      onlineCreators.filter((creator) =>
        selectedCreatorIds.includes(creator.id)
      ),
    [onlineCreators, selectedCreatorIds]
  );

  useEffect(() => {
    setSelectedCreatorIds((prev) => {
      const activeIds = onlineCreators.map((creator) => creator.id);
      const next = prev.filter((id) => activeIds.includes(id));
      activeIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });
      return next;
    });
  }, [onlineCreators]);

  useEffect(() => {
    if (
      editingCreator &&
      !creators.some((creator) => creator.id === editingCreator.id)
    ) {
      setEditingCreator(null);
      setEditState(null);
      setEditError(null);
    }
  }, [editingCreator, creators]);

  const isSubmitting = createMutation.isPending;

  const handleInputChange =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormState((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const startEditingCreator = useCallback(
    (creator: CreatorWithStatus) => {
      const normalizedTags = getCreatorTags(creator);
      setEditingCreator(creator);
      setEditState({
        platform: creator.platform,
        channelInput: creator.channelId,
        displayName: creator.displayName,
        notifyEnabled: creator.notifyEnabled,
        tagsInput: formatTagsInput(normalizedTags),
      });
      setEditError(null);
    },
    []
  );

  const handleEditInputChange =
    (field: keyof EditFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setEditState((prev) =>
        prev ? { ...prev, [field]: event.target.value } : prev
      );
    };

  const handleEditToggleNotify = (checked: boolean) => {
    setEditState((prev) =>
      prev ? { ...prev, notifyEnabled: checked } : prev
    );
  };

  const handleEditCancel = () => {
    setEditingCreator(null);
    setEditState(null);
    setEditError(null);
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCreator || !editState) {
      return;
    }

    setEditError(null);

    const detection = parseChannelInput(editState.channelInput);
    if (
      detection.platform &&
      detection.platform !== editingCreator.platform
    ) {
      setEditError("Channel URL belongs to a different platform.");
      return;
    }

    const channelId = (detection.channelId ?? editState.channelInput).trim();
    if (!channelId) {
      setEditError("Enter a valid channel URL or ID.");
      return;
    }

    const displayName =
      editState.displayName.trim() || channelId;
    const tags = parseTagsInput(editState.tagsInput);

    try {
      await editMutation.mutateAsync({
        id: editingCreator.id,
        displayName,
        channelId,
        notifyEnabled: editState.notifyEnabled,
        tags,
      });
      setEditingCreator(null);
      setEditState(null);
      setEditError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update creator.";
      setEditError(message);
    }
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

  const toggleCreatorSelection = useCallback(
    (creatorId: string) => {
      if (!onlineCreators.some((creator) => creator.id === creatorId)) {
        return;
      }
      setSelectedCreatorIds((prev) =>
        prev.includes(creatorId)
          ? prev.filter((id) => id !== creatorId)
          : [...prev, creatorId]
      );
    },
    [onlineCreators]
  );

  const handleOpenOnlineStreams = useCallback(async () => {
    if (!ready) {
      return;
    }

    let statusByCreator: Map<string, LiveStatus> | null = null;
    try {
      const statuses = await getStageDock().liveStatus.list();
      statusByCreator = new Map(
        statuses.map((status) => [status.creatorId, status])
      );
    } catch (error) {
      console.error(
        "Failed to refresh live status before opening multi-view:",
        error
      );
    }

    const urls = Array.from(
      new Set(
        selectedOnlineCreators
          .map(
            (creator) =>
              statusByCreator?.get(creator.id)?.streamUrl ??
              creator.liveStatus?.streamUrl ??
              buildStreamUrl(creator)
          )
          .filter((url): url is string => Boolean(url))
      )
    );

    if (urls.length === 0) {
      return;
    }

    try {
      await getStageDock().multiview.open(urls, "2x2");
    } catch (error) {
      console.error("Failed to open multi-view window for favorites:", error);
    }
  }, [ready, selectedOnlineCreators]);

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
    const tags = parseTagsInput(formState.tagsInput);

    try {
      await createMutation.mutateAsync({
        platform,
        channelId,
        displayName,
        notifyEnabled: formState.notifyEnabled,
        tags,
      });
      setFormState({
        ...DEFAULT_FORM_STATE,
        platform,
        notifyEnabled: formState.notifyEnabled,
      });
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
    <div className="section favorites-page" role="region">
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

          <div>
            <label className="label" htmlFor="tags">
              Tags (optional)
            </label>
            <input
              id="tags"
              value={formState.tagsInput}
              onChange={handleInputChange("tagsInput")}
              placeholder="team, collab, fps"
              className="input"
            />
            <p className="misc-note" style={{ marginTop: 6 }}>
              Separate multiple tags with commas or line breaks.
            </p>
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
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 className="section-title-small">Registered creators</h2>
            <span className="misc-note">
              {creatorsQuery.isLoading
                ? "Loading..."
                : `${creators.length} total`}
            </span>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={handleOpenOnlineStreams}
            disabled={!ready || selectedOnlineCreators.length === 0}
            style={{ whiteSpace: "nowrap" }}
          >
            {selectedOnlineCreators.length > 0
              ? `Open Selected (${selectedOnlineCreators.length})`
              : "Open Selected"}{" "}
            in Multi-view
          </button>
        </div>
        {tagFilterOptions.length > 0 && (
          <div
            className="tag-filter"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span className="misc-note">Filter by tag:</span>
            <button
              type="button"
              className={
                activeTagFilter === null
                  ? "button button-primary"
                  : "button button-outline"
              }
              onClick={() => setActiveTagFilter(null)}
            >
              All
            </button>
            {tagFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  activeTagFilter === option.value
                    ? "button button-primary"
                    : "button button-outline"
                }
                onClick={() =>
                  setActiveTagFilter((prev) =>
                    prev === option.value ? null : option.value
                  )
                }
              >
                {option.label} ({option.count})
              </button>
            ))}
          </div>
        )}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Display name</th>
                <th>Platform</th>
                <th>Channel ID</th>
                <th>Tags</th>
                <th>Notification</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCreators.length === 0 && !creatorsQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    {activeTagFilter
                      ? "No creators match the selected tag."
                      : "No favorites yet. Use the form above to add one."}
                  </td>
                </tr>
              ) : (
                filteredCreators.map((creator) => {
                  const normalizedTags = getCreatorTags(creator);
                  return (
                    <tr key={creator.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedCreatorIds.includes(creator.id)}
                        onChange={() => toggleCreatorSelection(creator.id)}
                        disabled={!creator.liveStatus?.isLive}
                        aria-label={`Select ${creator.displayName} for Multi-view`}
                      />
                    </td>
                    <td>{creator.displayName}</td>
                    <td>
                      <span
                        role="img"
                        aria-label={PLATFORM_LABELS[creator.platform]}
                        title={PLATFORM_LABELS[creator.platform]}
                      >
                        {PLATFORM_ICONS[creator.platform]}
                      </span>
                    </td>
                    <td>{creator.channelId}</td>
                    <td>
                      {normalizedTags.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                          }}
                        >
                          {normalizedTags.map((tag) => (
                            <span
                              key={tag}
                              className="misc-note"
                              style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "var(--color-surface-3, #1f1f1f)",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="misc-note">{UNTAGGED_TAG_LABEL}</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`notify-toggle ${
                          creator.notifyEnabled ? "is-on" : "is-off"
                        }`}
                        onClick={() => handleNotifyToggle(creator)}
                      ></button>
                    </td>
                    <td>
                      {creator.liveStatus?.isLive ? (
                        <span className="badge badge-live">Live</span>
                      ) : (
                        <span className="badge badge-offline">Offline</span>
                      )}
                    </td>
                    <td
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                      }}
                    >
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => startEditingCreator(creator)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => handleDelete(creator)}
                      >
                        Remove
                      </button>
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editingCreator && editState && (
        <div className="panel">
          <div
            className="section-heading"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 className="section-title-small">
                Edit {editingCreator.displayName}
              </h2>
              <span className="misc-note">
                Platform: {PLATFORM_LABELS[editState.platform]}
              </span>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={handleEditCancel}
              disabled={editMutation.isPending}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleEditSubmit} className="form-grid">
            <div>
              <label className="label" htmlFor="edit-displayName">
                Display name
              </label>
              <input
                id="edit-displayName"
                value={editState.displayName}
                onChange={handleEditInputChange("displayName")}
                className="input"
                placeholder="Display name"
              />
            </div>

            <div>
              <label className="label" htmlFor="edit-channel">
                Channel URL or ID
              </label>
              <input
                id="edit-channel"
                value={editState.channelInput}
                onChange={handleEditInputChange("channelInput")}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="edit-tags">
                Tags
              </label>
              <input
                id="edit-tags"
                value={editState.tagsInput}
                onChange={handleEditInputChange("tagsInput")}
                className="input"
                placeholder="team, collab, fps"
              />
              <p className="misc-note" style={{ marginTop: 6 }}>
                Separate multiple tags with commas or line breaks.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <label className="label" style={{ gap: 10, marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={editState.notifyEnabled}
                  onChange={(event) =>
                    handleEditToggleNotify(event.target.checked)
                  }
                  className="checkbox"
                />
                Enable notifications
              </label>

              <button
                type="submit"
                className="button button-primary"
                disabled={editMutation.isPending}
              >
                {editMutation.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>

            {editError && (
              <p className="button-danger" style={{ padding: "10px 14px" }}>
                {editError}
              </p>
            )}
          </form>
        </div>
      )}
      {tagGroups.length > 0 && (
        <div className="panel">
          <div
            className="section-heading"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 className="section-title-small">By tag</h2>
            <span className="misc-note">
              {tagGroups.reduce((total, group) => total + group.creators.length, 0)}{" "}
              assignments
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            {tagGroups.map((group) => (
              <div
                key={group.key}
                className="card"
                style={{ gap: 8, padding: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3 style={{ margin: 0 }}>{group.label}</h3>
                  <span className="misc-note">{group.creators.length}</span>
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    gap: 4,
                    display: "grid",
                  }}
                >
                  {group.creators.map((creator) => (
                    <li
                      key={creator.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span>{creator.displayName}</span>
                      <span
                        className={
                          creator.liveStatus?.isLive
                            ? "badge badge-live"
                            : "badge badge-offline"
                        }
                      >
                        {creator.liveStatus?.isLive ? "Live" : "Offline"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
