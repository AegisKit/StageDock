export const IPC_CHANNELS = {
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

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
