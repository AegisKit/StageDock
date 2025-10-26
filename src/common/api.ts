import type {
  CreateCreatorPayload,
  Creator,
  CreatorWithStatus,
  LiveStatus,
  SaveUrlSetPayload,
  SettingEntry,
  UpdateCreatorPayload,
  UrlSet,
} from "./types.js";

export interface StageDockAPI {
  openExternal: (url: string) => Promise<void>;
  quit: () => Promise<void>;
  creators: {
    list: () => Promise<CreatorWithStatus[]>;
    create: (payload: CreateCreatorPayload) => Promise<Creator>;
    update: (payload: UpdateCreatorPayload) => Promise<Creator>;
    delete: (id: string) => Promise<{ success: boolean }>;
    refreshStatus: (id: string) => Promise<LiveStatus | null>;
  };
  liveStatus: {
    list: () => Promise<LiveStatus[]>;
  };
  urlSets: {
    list: () => Promise<UrlSet[]>;
    save: (payload: SaveUrlSetPayload) => Promise<UrlSet>;
    delete: (id: string) => Promise<{ success: boolean }>;
    touch: (id: string) => Promise<UrlSet>;
  };
  settings: {
    get: <TValue = unknown>(key: string) => Promise<TValue | undefined>;
    set: <TValue = unknown>(
      key: string,
      value: TValue
    ) => Promise<SettingEntry<TValue>>;
  };
  multiview: {
    open: (urls: string[], layout: string) => Promise<void>;
    close: () => Promise<void>;
  };
  app: {
    getVersion: () => Promise<string>;
  };
  update: {
    check: () => Promise<any>;
    download: () => Promise<{ success: boolean }>;
    install: () => Promise<{ success: boolean }>;
  };
}
