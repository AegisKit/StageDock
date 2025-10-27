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
import { IPC_CHANNELS } from "../common/ipc.js";

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
  app: {
    getVersion: () => Promise<string>;
  };
  update: {
    check: () => Promise<any>;
    download: () => Promise<{ success: boolean }>;
    install: () => Promise<{ success: boolean }>;
    onProgress: (
      callback: (progress: {
        percent: number;
        transferred: number;
        total: number;
      }) => void
    ) => void;
    onStatus: (
      callback: (status: { isUpdating: boolean; message: string }) => void
    ) => void;
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
      return (await ipcRenderer.invoke(IPC_CHANNELS.CREATORS_REFRESH_STATUS, {
        id,
      })) as LiveStatus | null;
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
  app: {
    getVersion: async () => {
      return await ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION);
    },
  },
  update: {
    check: async () => {
      return await ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK);
    },
    download: async () => {
      return await ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD);
    },
    install: async () => {
      return await ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL);
    },
    onProgress: (
      callback: (progress: {
        percent: number;
        transferred: number;
        total: number;
      }) => void
    ) => {
      ipcRenderer.on(IPC_CHANNELS.UPDATE_PROGRESS, (_event, progress) => {
        callback(progress);
      });
    },
    onStatus: (
      callback: (status: { isUpdating: boolean; message: string }) => void
    ) => {
      ipcRenderer.on(IPC_CHANNELS.UPDATE_STATUS, (_event, status) => {
        callback(status);
      });
    },
  },
};

console.log("Preload script: Exposing StageDock API");
contextBridge.exposeInMainWorld("stagedock", api);

// マルチビューウィンドウ用のIPC通信
contextBridge.exposeInMainWorld("electronAPI", {
  onMultiviewData: (callback: (data: any) => void) => {
    ipcRenderer.on("multiview:data", (_, data) => callback(data));
  },
});

console.log("Preload script: Dispatching stagedock:ready event");
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
