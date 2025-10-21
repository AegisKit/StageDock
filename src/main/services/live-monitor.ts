import { logger } from "../utils/logger.js";
import type { StageDockDatabase } from "../database/database.js";
import { fetchTwitchLiveStatus } from "./platforms/twitch.js";
import { fetchYouTubeLiveStatus } from "./platforms/youtube.js";
import type { Creator, LiveStatus } from "../database/schema.js";
import { NotificationService } from "./notification.js";

interface LiveSnapshot {
  isLive: boolean;
}

export class LiveMonitor {
  private readonly pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private readonly lastState = new Map<string, LiveSnapshot>();
  private suppressNotifications = true;

  constructor(
    private readonly database: StageDockDatabase,
    private readonly notifications: NotificationService,
    pollIntervalMs = 60_000
  ) {
    this.pollIntervalMs = pollIntervalMs;
  }

  start() {
    this.suppressNotifications = true;
    void this.tick(true);
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(isInitial = false) {
    const creators = this.database.listCreators();
    logger.debug({ count: creators.length }, "Live monitor tick");
    try {
      await Promise.allSettled(
        creators.map((creator) => this.syncCreator(creator))
      );
    } finally {
      if (isInitial) {
        this.suppressNotifications = false;
      }
    }
  }

  private async syncCreator(creator: Creator) {
    try {
      if (creator.platform === "twitch") {
        await this.syncTwitchCreator(creator);
      } else if (creator.platform === "youtube") {
        await this.syncYouTubeCreator(creator);
      }
    } catch (error) {
      logger.warn({ error, creatorId: creator.id }, "Failed to sync creator");
    }
  }

  private async syncTwitchCreator(creator: Creator) {
    logger.debug(
      { creatorId: creator.id, channelId: creator.channelId },
      "Fetching Twitch live status"
    );
    const status = await fetchTwitchLiveStatus(creator.channelId);
    if (!status) {
      logger.warn(
        { creatorId: creator.id },
        "Twitch live status request returned null"
      );
      return;
    }

    await this.database.upsertLiveStatus({
      creatorId: creator.id,
      isLive: status.isLive,
      title: status.title ?? null,
      game: null,
      startedAt: status.startedAt ?? null,
      viewerCount: status.viewerCount ?? null,
      streamUrl: status.isLive
        ? status.streamUrl ?? `https://www.twitch.tv/${creator.channelId}`
        : null,
      updatedAt: new Date().toISOString(),
    });

    logger.info(
      {
        creatorId: creator.id,
        isLive: status.isLive,
        viewerCount: status.viewerCount ?? undefined,
      },
      "Updated Twitch live status"
    );

    this.handleTransition(creator, status.isLive, status.streamUrl);
  }

  private async syncYouTubeCreator(creator: Creator) {
    logger.debug(
      { creatorId: creator.id, channelId: creator.channelId },
      "Fetching YouTube live status"
    );
    const status = await fetchYouTubeLiveStatus(creator.channelId);
    if (!status) {
      logger.warn(
        { creatorId: creator.id },
        "YouTube live status request returned null"
      );
      return;
    }

    await this.database.upsertLiveStatus({
      creatorId: creator.id,
      isLive: status.isLive,
      title: status.title ?? null,
      game: null,
      startedAt: status.startedAt ?? null,
      viewerCount: status.viewerCount ?? null,
      streamUrl: status.isLive
        ? status.streamUrl ?? buildYouTubeUrl(creator.channelId, true)
        : null,
      updatedAt: new Date().toISOString(),
    });

    logger.info(
      {
        creatorId: creator.id,
        isLive: status.isLive,
        startedAt: status.startedAt ?? undefined,
      },
      "Updated YouTube live status"
    );

    this.handleTransition(creator, status.isLive, status.streamUrl);
  }

  private handleTransition(
    creator: Creator,
    isLive: boolean,
    streamUrl?: string | null
  ) {
    const previous = this.lastState.get(creator.id);
    this.lastState.set(creator.id, { isLive });

    if (this.suppressNotifications) {
      return;
    }

    if (isLive && !previous?.isLive && creator.notifyEnabled) {
      const url =
        streamUrl ??
        (creator.platform === "twitch"
          ? `https://www.twitch.tv/${creator.channelId}`
          : buildYouTubeUrl(creator.channelId, true));
      this.notifications.showLiveNotification({
        displayName: creator.displayName,
        platform: creator.platform === "twitch" ? "Twitch" : "YouTube",
        channelUrl: url,
      });
    }
  }
}

function buildYouTubeUrl(channelId: string, live = false) {
  if (channelId.startsWith("@")) {
    return live
      ? `https://www.youtube.com/${channelId}/live`
      : `https://www.youtube.com/${channelId}`;
  }
  if (channelId.startsWith("UC") || channelId.startsWith("HC")) {
    return live
      ? `https://www.youtube.com/channel/${channelId}/live`
      : `https://www.youtube.com/channel/${channelId}`;
  }
  return live
    ? `https://www.youtube.com/@${channelId}/live`
    : `https://www.youtube.com/@${channelId}`;
}

export async function refreshLiveStatusNow(
  database: StageDockDatabase,
  creatorId: string
): Promise<LiveStatus | null> {
  const creator = database.getCreatorById(creatorId);
  if (!creator) {
    logger.warn({ creatorId }, "Requested refresh for missing creator");
    return null;
  }

  try {
    if (creator.platform === "twitch") {
      logger.debug(
        { creatorId: creator.id, channelId: creator.channelId },
        "Manually refreshing Twitch live status"
      );
      const status = await fetchTwitchLiveStatus(creator.channelId);
      if (!status) {
        logger.warn(
          { creatorId: creator.id },
          "Twitch live status manual refresh returned null"
        );
        return null;
      }

      return database.upsertLiveStatus({
        creatorId: creator.id,
        isLive: status.isLive,
        title: status.title ?? null,
        game: null,
        startedAt: status.startedAt ?? null,
        viewerCount: status.viewerCount ?? null,
        streamUrl: status.isLive
          ? status.streamUrl ?? `https://www.twitch.tv/${creator.channelId}`
          : null,
        updatedAt: new Date().toISOString(),
      });
    }

    if (creator.platform === "youtube") {
      logger.debug(
        { creatorId: creator.id, channelId: creator.channelId },
        "Manually refreshing YouTube live status"
      );
      const status = await fetchYouTubeLiveStatus(creator.channelId);
      if (!status) {
        logger.warn(
          { creatorId: creator.id },
          "YouTube live status manual refresh returned null"
        );
        return null;
      }

      return database.upsertLiveStatus({
        creatorId: creator.id,
        isLive: status.isLive,
        title: status.title ?? null,
        game: null,
        startedAt: status.startedAt ?? null,
        viewerCount: status.viewerCount ?? null,
        streamUrl: status.isLive
          ? status.streamUrl ?? buildYouTubeUrl(creator.channelId, true)
          : null,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.warn(
      { creatorId: creator.id, platform: creator.platform, error },
      "Failed to manually refresh live status"
    );
  }

  return null;
}
