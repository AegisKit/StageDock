import { ipcMain } from "electron";
import { z } from "zod";
import { IPC_CHANNELS } from "../../../common/ipc.js";
import type { StageDockDatabase } from "../../database/database.js";
import {
  CreatorInsert,
  LiveStatusUpsert,
  UrlSetInsert,
  creatorInsertSchema,
  liveStatusUpsertSchema,
  urlSetInsertSchema,
} from "../../database/schema.js";
import { logger } from "../../utils/logger.js";

const creatorUpdateSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).optional(),
  channelId: z.string().min(1).optional(),
  notifyEnabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const deleteByIdSchema = z.object({
  id: z.string().uuid(),
});

const getSettingSchema = z.object({
  key: z.string().min(1),
});

const setSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export function registerIpcHandlers(database: StageDockDatabase): void {
  ipcMain.handle(IPC_CHANNELS.CREATORS_LIST, () => {
    const creators = database.listCreatorsWithStatus();
    logger.debug({ count: creators.length }, "Fetched creators for renderer");
    return creators;
  });

  ipcMain.handle(
    IPC_CHANNELS.CREATORS_CREATE,
    (_event, rawInput: CreatorInsert) => {
      const input = creatorInsertSchema.parse(rawInput);
      const existing = database.findCreatorByChannel(
        input.platform,
        input.channelId.trim()
      );
      if (existing) {
        throw new Error(
          "Creator already registered for this platform and channel"
        );
      }
      return database.createCreator(input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.CREATORS_UPDATE, (_event, rawInput) => {
    const input = creatorUpdateSchema.parse(rawInput);
    return database.updateCreator(input.id, {
      displayName: input.displayName,
      notifyEnabled: input.notifyEnabled,
      channelId: input.channelId,
      tags: input.tags,
    });
  });

  ipcMain.handle(IPC_CHANNELS.CREATORS_DELETE, (_event, rawInput) => {
    const { id } = deleteByIdSchema.parse(rawInput);
    database.deleteCreator(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.LIVE_STATUS_LIST, () => {
    return database.listLiveStatus();
  });

  ipcMain.handle(
    IPC_CHANNELS.LIVE_STATUS_UPSERT,
    (_event, rawInput: LiveStatusUpsert) => {
      const input = liveStatusUpsertSchema.parse(rawInput);
      return database.upsertLiveStatus(input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.URL_SETS_LIST, () => database.listUrlSets());

  ipcMain.handle(
    IPC_CHANNELS.URL_SETS_SAVE,
    (_event, rawInput: UrlSetInsert) => {
      const input = urlSetInsertSchema.parse(rawInput);
      return database.saveUrlSet(input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.URL_SETS_DELETE, (_event, rawInput) => {
    const { id } = deleteByIdSchema.parse(rawInput);
    database.deleteUrlSet(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.URL_SETS_TOUCH, (_event, rawInput) => {
    const { id } = deleteByIdSchema.parse(rawInput);
    const urlSet = database.touchUrlSet(id);
    if (!urlSet) {
      throw new Error("URL set not found");
    }
    return urlSet;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, rawInput) => {
    const { key } = getSettingSchema.parse(rawInput);
    return database.getSetting(key);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, rawInput) => {
    const { key, value } = setSettingSchema.parse(rawInput);
    database.setSetting(key, value);
    return { key, value };
  });

  ipcMain.handle(IPC_CHANNELS.MULTIVIEW_OPEN, async (_, { urls, layout }) => {
    logger.debug({ urls, layout }, "Opening multiview window");
    const { createMultiviewWindow } = await import("../../index.js");
    await createMultiviewWindow(urls, layout);
  });

  ipcMain.handle(IPC_CHANNELS.MULTIVIEW_CLOSE, async () => {
    logger.debug("Closing multiview window");
    const { multiviewWindow } = await import("../../index.js");
    if (multiviewWindow) {
      multiviewWindow.close();
    }
  });

  ipcMain.on("ipc:error", (_event, payload) => {
    logger.error(payload, "Renderer emitted IPC error event");
  });
}
