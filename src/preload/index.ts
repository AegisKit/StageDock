import { contextBridge, ipcRenderer } from "electron";
import type {
  CreateCreatorPayload,
  Creator,
  CreatorWithStatus,
  LiveStatus,
  SaveUrlSetPayload,
  SettingEntry,
  UpdateCreatorPayload,
  UrlSet,
} from "../common/types.js";

const IPC_CHANNELS = {
  OPEN_EXTERNAL: "app:open-external",
  QUIT: "app:quit",
  CREATORS_LIST: "creators:list",
  CREATORS_CREATE: "creators:create",
  CREATORS_UPDATE: "creators:update",
  CREATORS_DELETE: "creators:delete",
  CREATORS_REFRESH_STATUS: "creators:refresh-status",
  LIVE_STATUS_LIST: "live-status:list",
  LIVE_STATUS_UPSERT: "live-status:upsert",
  URL_SETS_LIST: "url-sets:list",
  URL_SETS_SAVE: "url-sets:save",
  URL_SETS_DELETE: "url-sets:delete",
  URL_SETS_TOUCH: "url-sets:touch",
  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",
  MULTIVIEW_OPEN: "multiview:open",
  MULTIVIEW_CLOSE: "multiview:close",
} as const;

export type StageDockAPI = {
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
};

const api: StageDockAPI = {
  openExternal: async (url) => {
    await ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url);
  },
  quit: async () => {
    await ipcRenderer.invoke(IPC_CHANNELS.QUIT);
  },
  creators: {
    list: async () => {
      return (await ipcRenderer.invoke(
        IPC_CHANNELS.CREATORS_LIST
      )) as CreatorWithStatus[];
    },
    create: async (payload) => {
      return (await ipcRenderer.invoke(
        IPC_CHANNELS.CREATORS_CREATE,
        payload
      )) as Creator;
    },
    update: async (payload) => {
      return (await ipcRenderer.invoke(
        IPC_CHANNELS.CREATORS_UPDATE,
        payload
      )) as Creator;
    },
    delete: async (id) => {
      return (await ipcRenderer.invoke(IPC_CHANNELS.CREATORS_DELETE, {
        id,
      })) as { success: boolean };
    },
    refreshStatus: async (id) => {
      return (await ipcRenderer.invoke(
        IPC_CHANNELS.CREATORS_REFRESH_STATUS,
        { id }
      )) as LiveStatus | null;
    },
  },
  liveStatus: {
    list: async () => {
      return (await ipcRenderer.invoke(
        IPC_CHANNELS.LIVE_STATUS_LIST
      )) as LiveStatus[];
    },
  },
  urlSets: {
    list: async () => {
      return (await ipcRenderer.invoke(IPC_CHANNELS.URL_SETS_LIST)) as UrlSet[];
    },
    save: async (payload) => {
      return (await ipcRenderer.invoke(
        IPC_CHANNELS.URL_SETS_SAVE,
        payload
      )) as UrlSet;
    },
    delete: async (id) => {
      return (await ipcRenderer.invoke(IPC_CHANNELS.URL_SETS_DELETE, {
        id,
      })) as { success: boolean };
    },
    touch: async (id) => {
      return (await ipcRenderer.invoke(IPC_CHANNELS.URL_SETS_TOUCH, {
        id,
      })) as UrlSet;
    },
  },
  settings: {
    get: async <TValue = unknown>(key: string) => {
      return (await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, { key })) as
        | TValue
        | undefined;
    },
    set: async <TValue = unknown>(key: string, value: TValue) => {
      return (await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, {
        key,
        value,
      })) as SettingEntry<TValue>;
    },
  },
  multiview: {
    open: async (urls: string[], layout: string) => {
      return await ipcRenderer.invoke(IPC_CHANNELS.MULTIVIEW_OPEN, {
        urls,
        layout,
      });
    },
    close: async () => {
      return await ipcRenderer.invoke(IPC_CHANNELS.MULTIVIEW_CLOSE);
    },
  },
};

contextBridge.exposeInMainWorld("stagedock", api);

// マルチビューウィンドウ用のIPC通信
contextBridge.exposeInMainWorld("electronAPI", {
  onMultiviewData: (callback: (data: any) => void) => {
    ipcRenderer.on("multiview:data", (_, data) => callback(data));
  },
});

if (typeof window !== "undefined") {
  window.dispatchEvent(new Event("stagedock:ready"));
}

declare global {
  interface Window {
    stagedock: StageDockAPI;
    electronAPI: {
      onMultiviewData: (callback: (data: any) => void) => void;
    };
  }
}
