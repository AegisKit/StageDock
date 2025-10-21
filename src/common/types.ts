export type CreatorPlatform = 'twitch' | 'youtube';

export interface Creator {
  id: string;
  platform: CreatorPlatform;
  channelId: string;
  displayName: string;
  notifyEnabled: boolean;
  createdAt: string;
}

export interface LiveStatus {
  creatorId: string;
  isLive: boolean;
  title: string | null;
  game: string | null;
  startedAt: string | null;
  viewerCount: number | null;
  updatedAt: string;
}

export interface CreatorWithStatus extends Creator {
  liveStatus: LiveStatus | null;
}

export interface UrlSet {
  id: string;
  name: string;
  urls: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreateCreatorPayload {
  platform: CreatorPlatform;
  channelId: string;
  displayName: string;
  notifyEnabled?: boolean;
}

export interface UpdateCreatorPayload {
  id: string;
  displayName?: string;
  notifyEnabled?: boolean;
}

export interface SaveUrlSetPayload {
  id?: string;
  name: string;
  urls: string[];
  lastUsedAt?: string | null;
}

export interface SettingEntry<TValue = unknown> {
  key: string;
  value: TValue;
}
