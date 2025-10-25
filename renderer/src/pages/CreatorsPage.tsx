import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent, JSX } from "react";
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
} from "../hooks/use-creators";
import { useStageDockReady } from "../hooks/use-stagedock-ready";
import { getStageDock } from "../lib/stagedock";

// 配信詳細情報のホバーコンポーネント
interface StreamDetailsProps {
  creator: CreatorWithStatus;
  isVisible: boolean;
  position: { x: number; y: number };
}

function StreamDetails({ creator, isVisible, position }: StreamDetailsProps) {
  if (!isVisible || !creator.liveStatus?.isLive) {
    return null;
  }

  const { liveStatus } = creator;
  const startedAt = liveStatus.startedAt
    ? new Date(liveStatus.startedAt)
    : null;

  // 配信時間の表示形式を改善
  const formatDuration = (startedAt: Date) => {
    const now = Date.now();
    const diffMs = now - startedAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes}分`;
    }

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours < 24) {
      return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (remainingHours === 0) {
      return `${days}日`;
    } else if (minutes === 0) {
      return `${days}日${remainingHours}時間`;
    } else {
      return `${days}日${remainingHours}時間${minutes}分`;
    }
  };

  const duration = startedAt ? formatDuration(startedAt) : null;

  return (
    <div
      className="stream-details-hover"
      style={{
        position: "fixed",
        left: position.x + 10,
        top: position.y - 10,
        zIndex: 1000,
        background: "#2a2a2a",
        border: "1px solid #404040",
        borderRadius: "8px",
        padding: "12px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        minWidth: "280px",
        maxWidth: "400px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        {PLATFORM_ICONS[creator.platform]}
        <span style={{ fontWeight: "bold", color: "#ffffff" }}>
          {creator.displayName}
        </span>
        <span className="badge badge-live" style={{ fontSize: "12px" }}>
          LIVE
        </span>
      </div>

      {liveStatus.title && (
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              color: "#ffffff",
              marginBottom: "4px",
            }}
          >
            配信タイトル
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#cccccc",
              lineHeight: "1.4",
            }}
          >
            {liveStatus.title}
          </div>
        </div>
      )}

      {liveStatus.game && (
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              color: "#ffffff",
              marginBottom: "4px",
            }}
          >
            ゲーム/カテゴリ
          </div>
          <div style={{ fontSize: "13px", color: "#666666" }}>
            {liveStatus.game}
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "16px",
          fontSize: "12px",
          color: "#cccccc",
        }}
      >
        {liveStatus.viewerCount !== null && (
          <div>
            <span style={{ fontWeight: "bold" }}>視聴者数: </span>
            {liveStatus.viewerCount.toLocaleString()}
          </div>
        )}
        {duration !== null && (
          <div>
            <span style={{ fontWeight: "bold" }}>配信時間: </span>
            {duration}
          </div>
        )}
      </div>

      {startedAt && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "#cccccc",
          }}
        >
          <span style={{ fontWeight: "bold" }}>開始時刻: </span>
          {startedAt.toLocaleString("ja-JP")}
        </div>
      )}
    </div>
  );
}

const PLATFORM_LABELS: Record<CreatorPlatform, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
};

const PLATFORM_ICONS: Record<CreatorPlatform, JSX.Element> = {
  twitch: (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      aria-hidden="true"
    >
      <path
        fill="#9146FF"
        d="M2 0h20v13l-5 5h-4.5l-3.5 3.5V18H6l-4-4V0Zm18 11V2H6v12h5v2.5L14.5 14H18l2-2Z"
      />
      <path fill="#fff" d="M10 6h2v5h-2zm5 0h2v5h-2z" />
    </svg>
  ),
  youtube: (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      aria-hidden="true"
    >
      <path
        fill="#FF0000"
        d="M21.8 6.8a2.73 2.73 0 0 0-1.9-1.9C18.4 4.2 12 4.2 12 4.2s-6.4 0-7.9.7A2.73 2.73 0 0 0 2.2 6.8C1.5 8.3 1.5 12 1.5 12s0 3.7.7 5.2a2.73 2.73 0 0 0 1.9 1.9c1.5.7 7.9.7 7.9.7s6.4 0 7.9-.7a2.73 2.73 0 0 0 1.9-1.9c.7-1.5.7-5.2.7-5.2s0-3.7-.7-5.2Z"
      />
      <path fill="#fff" d="M9.75 8.5v7L15.5 12z" />
    </svg>
  ),
};

const LIVE_LINK_BUTTON_STYLE: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  margin: 0,
  font: "inherit",
  color: "var(--accent)",
  textDecoration: "underline",
  cursor: "pointer",
};

const UNTAGGED_TAG_VALUE = "__untagged__";
const UNTAGGED_TAG_LABEL = "Untagged";

function parseTagsInput(value: string): string[] {
  const tags = Array.from(
    new Set(
      value
        .split(/,|\r?\n/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );
  // 最大10件に制限
  return tags.slice(0, 10);
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
    // 50音順でソート（日本語対応）
    return a.displayName.localeCompare(b.displayName, "ja", {
      sensitivity: "base",
      numeric: true,
      caseFirst: "lower",
    });
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

export function CreatorsPage() {
  const ready = useStageDockReady();
  const creatorsQuery = useCreators();
  const createMutation = useCreateCreator();
  const updateMutation = useUpdateCreator();
  const editMutation = useUpdateCreator();
  const deleteMutation = useDeleteCreator();

  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM_STATE);
  const [inputError, setInputError] = useState<string | null>(null);
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [editingCreator, setEditingCreator] =
    useState<CreatorWithStatus | null>(null);
  const [editState, setEditState] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // ホバー状態の管理
  const [hoveredCreator, setHoveredCreator] =
    useState<CreatorWithStatus | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const creators = creatorsQuery.data ?? [];
  const sortedCreators = useMemo(() => sortCreators(creators), [creators]);
  const onlineCreators = useMemo(
    () => sortedCreators.filter((creator) => creator.liveStatus?.isLive),
    [sortedCreators]
  );

  const tagGroups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; creators: CreatorWithStatus[] }
    >();

    sortedCreators.forEach((creator) => {
      const tags = getCreatorTags(creator);
      if (tags.length === 0) {
        const entry = map.get(UNTAGGED_TAG_VALUE) ?? {
          label: UNTAGGED_TAG_LABEL,
          creators: [] as CreatorWithStatus[],
        };
        entry.creators.push(creator);
        map.set(UNTAGGED_TAG_VALUE, entry);
      } else {
        tags.forEach((tag) => {
          const entry = map.get(tag) ?? {
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
      tagGroups
        .map(({ key, label, creators }) => ({
          value: key,
          label,
          count: creators.length,
        }))
        .sort((a, b) =>
          a.label.localeCompare(b.label, "ja", {
            sensitivity: "base",
            numeric: true,
            caseFirst: "lower",
          })
        ),
    [tagGroups]
  );

  useEffect(() => {
    // 無効なタグフィルターをクリア
    const validFilters = activeTagFilters.filter((filter) =>
      tagFilterOptions.some((option) => option.value === filter)
    );
    if (validFilters.length !== activeTagFilters.length) {
      setActiveTagFilters(validFilters);
    }
  }, [activeTagFilters, tagFilterOptions]);

  const filteredCreators = useMemo(() => {
    if (activeTagFilters.length === 0) {
      return sortedCreators;
    }

    return sortedCreators.filter((creator) => {
      const creatorTags = getCreatorTags(creator);

      // すべての選択されたタグがクリエイターに含まれているかチェック（AND条件）
      return activeTagFilters.every((filter) => {
        if (filter === UNTAGGED_TAG_VALUE) {
          return creatorTags.length === 0;
        }
        return creatorTags.includes(filter);
      });
    });
  }, [sortedCreators, activeTagFilters]);

  // 選択されたタグに基づいて利用可能なタグをフィルタリング
  const availableTagOptions = useMemo(() => {
    if (activeTagFilters.length === 0) {
      return tagFilterOptions;
    }

    // 選択されたタグを持つクリエイターを取得
    const creatorsWithSelectedTags = sortedCreators.filter((creator) => {
      const creatorTags = getCreatorTags(creator);
      return activeTagFilters.every((filter) => {
        if (filter === UNTAGGED_TAG_VALUE) {
          return creatorTags.length === 0;
        }
        return creatorTags.includes(filter);
      });
    });

    // これらのクリエイターが持つタグのみを表示
    const availableTags = new Set<string>();
    creatorsWithSelectedTags.forEach((creator) => {
      getCreatorTags(creator).forEach((tag) => availableTags.add(tag));
    });

    // Untaggedオプションも含める
    if (
      creatorsWithSelectedTags.some(
        (creator) => getCreatorTags(creator).length === 0
      )
    ) {
      availableTags.add(UNTAGGED_TAG_VALUE);
    }

    // 各タグについて、現在の条件 + そのタグを持つクリエイター数を計算
    return tagFilterOptions
      .filter((option) => availableTags.has(option.value))
      .map((option) => {
        // 現在の条件 + そのタグを持つクリエイターをカウント
        const count = sortedCreators.filter((creator) => {
          const creatorTags = getCreatorTags(creator);

          // 現在選択されているタグの条件を満たすかチェック
          const meetsCurrentConditions = activeTagFilters.every((filter) => {
            if (filter === UNTAGGED_TAG_VALUE) {
              return creatorTags.length === 0;
            }
            return creatorTags.includes(filter);
          });

          if (!meetsCurrentConditions) {
            return false;
          }

          // そのタグも持っているかチェック
          if (option.value === UNTAGGED_TAG_VALUE) {
            return creatorTags.length === 0;
          }
          return creatorTags.includes(option.value);
        }).length;

        return {
          ...option,
          count,
        };
      });
  }, [tagFilterOptions, activeTagFilters, sortedCreators]);

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
      // 既存の選択を維持し、削除されたクリエイターのみ除外
      return prev.filter((id) => activeIds.includes(id));
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

  const handleOpenStream = useCallback((creator: CreatorWithStatus) => {
    const targetUrl = creator.liveStatus?.streamUrl ?? buildStreamUrl(creator);
    if (!targetUrl) {
      return;
    }
    void getStageDock().openExternal(targetUrl);
  }, []);

  // ホバーイベントハンドラー
  const handleMouseEnter = useCallback(
    (creator: CreatorWithStatus, event: React.MouseEvent) => {
      if (creator.liveStatus?.isLive) {
        setHoveredCreator(creator);
        setHoverPosition({ x: event.clientX, y: event.clientY });
      }
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredCreator(null);
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (hoveredCreator) {
        setHoverPosition({ x: event.clientX, y: event.clientY });
      }
    },
    [hoveredCreator]
  );

  // タグクリックハンドラー
  const handleTagClick = useCallback((tag: string) => {
    setActiveTagFilters((prev) => {
      if (prev.includes(tag)) {
        // 既に選択されている場合は削除
        return prev.filter((t) => t !== tag);
      } else {
        // 新しく追加
        return [...prev, tag];
      }
    });
  }, []);

  // タグフィルターのクリア
  const clearTagFilters = useCallback(() => {
    setActiveTagFilters([]);
  }, []);

  // タグの選択/選択解除
  const toggleTagFilter = useCallback((tag: string) => {
    setActiveTagFilters((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  }, []);

  // ドロップダウンの開閉
  const toggleTagDropdown = useCallback(() => {
    setIsTagDropdownOpen((prev) => !prev);
  }, []);

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isTagDropdownOpen && !target.closest(".tag-filter")) {
        setIsTagDropdownOpen(false);
      }
    };

    if (isTagDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isTagDropdownOpen]);

  const startEditingCreator = useCallback((creator: CreatorWithStatus) => {
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
  }, []);

  const handleEditInputChange =
    (field: keyof EditFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      setEditState((prev) =>
        prev ? { ...prev, [field]: event.target.value } : prev
      );
    };

  const handleEditToggleNotify = (checked: boolean) => {
    setEditState((prev) => (prev ? { ...prev, notifyEnabled: checked } : prev));
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
    if (detection.platform && detection.platform !== editingCreator.platform) {
      setEditError("Channel URL belongs to a different platform.");
      return;
    }

    const channelId = (detection.channelId ?? editState.channelInput).trim();
    if (!channelId) {
      setEditError("Enter a valid channel URL or ID.");
      return;
    }

    const displayName = editState.displayName.trim() || channelId;
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
        error instanceof Error ? error.message : "Failed to update creator.";
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
      console.error("Failed to open multi-view window for creators:", error);
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
      const newCreator = await createMutation.mutateAsync({
        platform,
        channelId,
        displayName,
        notifyEnabled: formState.notifyEnabled,
        tags,
      });
      if (newCreator) {
        try {
          await getStageDock().creators.refreshStatus(newCreator.id);
        } catch (refreshError) {
          console.error(
            "Failed to refresh live status immediately after creation:",
            refreshError
          );
        }
        await creatorsQuery.refetch();
      }
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
    <div className="section creators-page" role="region">
      <div className="section-heading">
        <h1 className="section-title">Creators</h1>
        <p className="section-description">
          Register Twitch or YouTube channels, manage notifications, and keep
          live creators at the top of your list.
        </p>
      </div>

      <form className="panel" onSubmit={handleSubmit}>
        <div className="form-grid">
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
              style={{ transform: "scale(0.6)" }}
            />
          </label>
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Add creator"}
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
            <h2 className="section-title-small">Creators</h2>
            <span className="misc-note">
              {creatorsQuery.isLoading
                ? "Loading..."
                : `${filteredCreators.length} creators`}
              {activeTagFilters.length > 0 && (
                <span
                  style={{ marginLeft: "8px", color: "var(--accent, #007acc)" }}
                >
                  (filtered by: {activeTagFilters.join(", ")})
                </span>
              )}
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
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              position: "relative",
            }}
          >
            <label
              className="label"
              style={{ marginBottom: 0, whiteSpace: "nowrap" }}
            >
              Filter by tag:
            </label>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="button button-outline"
                onClick={toggleTagDropdown}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: "200px",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  {activeTagFilters.length === 0
                    ? "Select tags..."
                    : `${activeTagFilters.length} tag(s) selected`}
                </span>
                <span
                  style={{
                    transform: isTagDropdownOpen
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  ▼
                </span>
              </button>

              {isTagDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "var(--color-surface-1, #2a2a2a)",
                    border: "1px solid var(--color-border, #404040)",
                    borderRadius: "6px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    zIndex: 1000,
                    maxHeight: "300px",
                    overflowY: "auto",
                    marginTop: "4px",
                  }}
                >
                  {availableTagOptions.map((option) => (
                    <label
                      key={option.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        cursor: "pointer",
                        backgroundColor: activeTagFilters.includes(option.value)
                          ? "var(--accent, #007acc)"
                          : "transparent",
                        color: activeTagFilters.includes(option.value)
                          ? "white"
                          : "inherit",
                        transition: "background-color 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!activeTagFilters.includes(option.value)) {
                          e.currentTarget.style.backgroundColor =
                            "var(--color-surface-2, #404040)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!activeTagFilters.includes(option.value)) {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={activeTagFilters.includes(option.value)}
                        onChange={() => toggleTagFilter(option.value)}
                        style={{ margin: 0 }}
                      />
                      <span style={{ flex: 1 }}>
                        {option.label} ({option.count})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {activeTagFilters.length > 0 && (
              <button
                type="button"
                className="button button-outline button-sm"
                onClick={clearTagFilters}
                style={{ whiteSpace: "nowrap" }}
              >
                Clear ({activeTagFilters.length})
              </button>
            )}
          </div>
        )}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ textAlign: "center" }}>Select</th>
                <th>Display name</th>
                <th style={{ textAlign: "center" }}>Platform</th>
                <th>Tags</th>
                <th>Notification</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCreators.length === 0 && !creatorsQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    {activeTagFilters.length > 0
                      ? "No creators match the selected tags."
                      : "No creators yet. Use the form above to add one."}
                  </td>
                </tr>
              ) : (
                filteredCreators.map((creator) => {
                  const normalizedTags = getCreatorTags(creator);
                  return (
                    <tr key={creator.id}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedCreatorIds.includes(creator.id)}
                          onChange={() => toggleCreatorSelection(creator.id)}
                          disabled={!creator.liveStatus?.isLive}
                          aria-label={`Select ${creator.displayName} for Multi-view`}
                          style={{ transform: "scale(1.3)" }}
                        />
                      </td>
                      <td>
                        {creator.liveStatus?.isLive ? (
                          <button
                            type="button"
                            style={LIVE_LINK_BUTTON_STYLE}
                            onClick={() => handleOpenStream(creator)}
                            onMouseEnter={(e) => handleMouseEnter(creator, e)}
                            onMouseLeave={handleMouseLeave}
                            onMouseMove={handleMouseMove}
                            aria-label={`Open ${creator.displayName}'s live stream`}
                          >
                            <span
                              style={{ fontSize: "16px", fontWeight: "bold" }}
                            >
                              {creator.displayName}
                            </span>
                          </button>
                        ) : (
                          <span
                            style={{ fontSize: "16px", fontWeight: "bold" }}
                          >
                            {creator.displayName}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          role="img"
                          aria-label={PLATFORM_LABELS[creator.platform]}
                          title={PLATFORM_LABELS[creator.platform]}
                        >
                          {PLATFORM_ICONS[creator.platform]}
                        </span>
                      </td>
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
                                  background: activeTagFilters.includes(tag)
                                    ? "var(--accent, #007acc)"
                                    : "var(--color-surface-3, #1f1f1f)",
                                  color: activeTagFilters.includes(tag)
                                    ? "white"
                                    : "inherit",
                                  cursor: "pointer",
                                  userSelect: "none",
                                  transition:
                                    "background-color 0.2s ease, color 0.2s ease",
                                }}
                                onClick={() => handleTagClick(tag)}
                                title={`Click to filter by "${tag}"`}
                                onMouseEnter={(e) => {
                                  if (!activeTagFilters.includes(tag)) {
                                    e.currentTarget.style.background =
                                      "var(--color-surface-2, #2a2a2a)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!activeTagFilters.includes(tag)) {
                                    e.currentTarget.style.background =
                                      "var(--color-surface-3, #1f1f1f)";
                                  }
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="misc-note">
                            {UNTAGGED_TAG_LABEL}
                          </span>
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
                      <td style={{ textAlign: "left" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-start",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            minWidth: 160,
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
                        </div>
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
                  style={{ transform: "scale(0.8)" }}
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

      {/* 配信詳細情報のホバー表示 */}
      {hoveredCreator && (
        <StreamDetails
          creator={hoveredCreator}
          isVisible={true}
          position={hoverPosition}
        />
      )}
    </div>
  );
}
