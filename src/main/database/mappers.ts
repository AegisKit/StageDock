import { creatorSchema, liveStatusSchema, settingSchema, urlSetSchema } from './schema.js';

type CreatorRow = {
  id: string;
  platform: string;
  channel_id: string;
  display_name: string;
  notify_enabled: number;
  created_at: string;
  tags: string;
};

type LiveStatusRow = {
  creator_id: string;
  is_live: number;
  title: string | null;
  game: string | null;
  started_at: string | null;
  viewer_count: number | null;
  stream_url: string | null;
  updated_at: string;
};

type UrlSetRow = {
  id: string;
  name: string;
  urls: string;
  created_at: string;
  last_used_at: string | null;
};

type SettingRow = {
  key: string;
  value: string;
};

export function mapCreatorRow(row: CreatorRow) {
  let tags: string[] = [];
  if (row.tags) {
    try {
      const parsed = JSON.parse(row.tags);
      if (Array.isArray(parsed)) {
        tags = parsed.filter((tag): tag is string => typeof tag === 'string');
      }
    } catch {
      tags = [];
    }
  }

  return creatorSchema.parse({
    id: row.id,
    platform: row.platform,
    channelId: row.channel_id,
    displayName: row.display_name,
    notifyEnabled: Boolean(row.notify_enabled),
    createdAt: row.created_at,
    tags
  });
}

export function mapLiveStatusRow(row: LiveStatusRow) {
  return liveStatusSchema.parse({
    creatorId: row.creator_id,
    isLive: Boolean(row.is_live),
    title: row.title,
    game: row.game,
    startedAt: row.started_at,
    viewerCount: row.viewer_count,
    streamUrl: row.stream_url,
    updatedAt: row.updated_at
  });
}

export function mapUrlSetRow(row: UrlSetRow) {
  return urlSetSchema.parse({
    id: row.id,
    name: row.name,
    urls: JSON.parse(row.urls) as string[],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at
  });
}

export function mapSettingRow<RowValue extends SettingRow>(row: RowValue) {
  return settingSchema.parse({
    key: row.key,
    value: JSON.parse(row.value)
  });
}
