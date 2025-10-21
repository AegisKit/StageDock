import DatabaseConstructor from "better-sqlite3";

import { randomUUID } from "node:crypto";

import { mkdir } from "node:fs/promises";

import path from "node:path";

import { app } from "electron";

import type { Database as BetterSqlite3Database } from "better-sqlite3";

import { logger } from "../utils/logger.js";

import {

  Creator,

  CreatorInsert,

  LiveStatus,

  LiveStatusUpsert,

  UrlSet,

  UrlSetInsert,

  creatorInsertSchema,

  liveStatusUpsertSchema,

  settingSchema,

  urlSetInsertSchema,

} from "./schema.js";

import {

  mapCreatorRow,

  mapLiveStatusRow,

  mapSettingRow,

  mapUrlSetRow,

} from "./mappers.js";



const SQLITE_DATE_FORMAT = () => new Date().toISOString();



function toBoolean(value: unknown): 0 | 1 {

  return value ? 1 : 0;

}



export class StageDockDatabase {

  private readonly db: BetterSqlite3Database;



  private constructor(private readonly dbPath: string) {

    this.db = new DatabaseConstructor(this.dbPath);

    this.db.pragma("journal_mode = WAL");

    this.db.pragma("foreign_keys = ON");

    this.initializeSchema();

  }



  static async create(): Promise<StageDockDatabase> {

    const userData = app.getPath("userData");

    await mkdir(userData, { recursive: true });

    const dbFilePath = path.join(userData, "stagedock.db");

    logger.info({ dbFilePath }, "Initializing StageDock database");

    return new StageDockDatabase(dbFilePath);

  }



  close(): void {

    this.db.close();

  }



  private initializeSchema(): void {

    const createStatements = `

      CREATE TABLE IF NOT EXISTS creators (

        id TEXT PRIMARY KEY,

        platform TEXT NOT NULL CHECK (platform IN ('twitch', 'youtube')),

        channel_id TEXT NOT NULL,

        display_name TEXT NOT NULL,

        notify_enabled INTEGER NOT NULL DEFAULT 1,

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (platform, channel_id)

      );



        CREATE TABLE IF NOT EXISTS live_status (

          creator_id TEXT PRIMARY KEY REFERENCES creators(id) ON DELETE CASCADE,

          is_live INTEGER NOT NULL,

          title TEXT,

          game TEXT,

          started_at TEXT,

          viewer_count INTEGER,

          stream_url TEXT,

          updated_at TEXT NOT NULL

        );



      CREATE TABLE IF NOT EXISTS url_sets (

        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        urls TEXT NOT NULL,

        created_at TEXT NOT NULL,

        last_used_at TEXT

      );



      CREATE TABLE IF NOT EXISTS settings (

        key TEXT PRIMARY KEY,

        value TEXT NOT NULL

      );



      CREATE INDEX IF NOT EXISTS idx_creators_platform_channel ON creators(platform, channel_id);

      CREATE INDEX IF NOT EXISTS idx_live_status_is_live ON live_status(is_live);

      CREATE INDEX IF NOT EXISTS idx_url_sets_last_used ON url_sets(last_used_at DESC);

    `;



    this.db.exec(createStatements);
    try {
      this.db.exec(
        "ALTER TABLE creators ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'"
      );
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes("duplicate column name")
      ) {
        logger.warn({ error }, "Failed to ensure tags column on creators");
      }
    }
    try {
      this.db.exec("ALTER TABLE live_status ADD COLUMN stream_url TEXT");
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes("duplicate column name")

      ) {

        logger.warn({ error }, "Failed to ensure stream_url column on live_status");

      }

    }

    this.initializeDefaultData();

  }



  private initializeDefaultData(): void {

    // ������creators�����邩�`�F�b�N

    const existingCreators = this.db

      .prepare<unknown[], any>("SELECT COUNT(*) as count FROM creators")

      .get() as { count: number };



    // ���Ƀf�[�^������ꍇ�͏��������X�L�b�v

    if (existingCreators.count > 0) {

      logger.debug("Default creators already exist, skipping initialization");

      return;

    }



    logger.info("Initializing default creators");



    // �f�t�H���g��favorites��3���o�^

    const defaultCreators = [

      {

        platform: "twitch" as const,

        channelId: "ninja",

        displayName: "Ninja",

        notifyEnabled: true,

      },

      {

        platform: "twitch" as const,

        channelId: "shroud",

        displayName: "Shroud",

        notifyEnabled: true,

      },

      {

        platform: "youtube" as const,

        channelId: "@MrBeast",

        displayName: "MrBeast",

        notifyEnabled: true,

      },

    ];



    for (const creator of defaultCreators) {

      try {

        this.createCreator(creator);

        logger.debug({ creator }, "Created default creator");

      } catch (error) {

        logger.warn({ error, creator }, "Failed to create default creator");

      }

    }

  }



  listCreators(): Creator[] {

    const rows = this.db

      .prepare<unknown[], any>(

        `

        SELECT id, platform, channel_id, display_name, notify_enabled, created_at, tags
        FROM creators

        ORDER BY created_at DESC

      `

      )

      .all();

    return rows.map(mapCreatorRow);

  }



  getCreatorById(id: string): Creator | undefined {

    const row = this.db

      .prepare<[string], any>(

        `

        SELECT id, platform, channel_id, display_name, notify_enabled, created_at, tags
        FROM creators

        WHERE id = ?

      `

      )

      .get(id);

    return row ? mapCreatorRow(row) : undefined;

  }



  findCreatorByChannel(

    platform: string,

    channelId: string

  ): Creator | undefined {

    const row = this.db

      .prepare<[string, string], any>(

        `

        SELECT id, platform, channel_id, display_name, notify_enabled, created_at, tags
        FROM creators

        WHERE platform = ? AND channel_id = ?

      `

      )

      .get(platform, channelId);

    return row ? mapCreatorRow(row) : undefined;

  }



  createCreator(input: CreatorInsert): Creator {

    const normalized = {

      ...input,

      id: input.id ?? randomUUID(),

      createdAt: input.createdAt ?? SQLITE_DATE_FORMAT(),

    };



    const payload = creatorInsertSchema.parse(normalized);

    const id = normalized.id;



    try {

      this.db

        .prepare(

          `

          INSERT INTO creators (id, platform, channel_id, display_name, notify_enabled, created_at, tags)

          VALUES (@id, @platform, @channelId, @displayName, @notifyEnabled, @createdAt, @tags)

        `

        )

        .run({

          id,

          platform: payload.platform,

          channelId: payload.channelId,

          displayName: payload.displayName,

          notifyEnabled: toBoolean(payload.notifyEnabled ?? true),

          createdAt: payload.createdAt ?? normalized.createdAt,

        });

    } catch (error: unknown) {

      if (

        error instanceof Error &&

        "code" in error &&

        (error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE"

      ) {

        throw new Error(

          "Creator already exists for the provided platform and channel ID"

        );

      }

      throw error;

    }



    const creator = this.getCreatorById(id);

    if (!creator) {

      throw new Error("Failed to load creator after insertion");

    }

    return creator;

  }



  updateCreator(

    id: string,

    patch: Partial<Pick<Creator, "displayName" | "notifyEnabled">>

  ): Creator {

    const existing = this.getCreatorById(id);

    if (!existing) {

      throw new Error(`Creator with id ${id} was not found`);

    }



    const next: Creator = {

      ...existing,

      ...patch,

      displayName: patch.displayName ?? existing.displayName,

      notifyEnabled: patch.notifyEnabled ?? existing.notifyEnabled,

    };



    this.db

      .prepare(

        `

        UPDATE creators

        SET display_name = @displayName,

            notify_enabled = @notifyEnabled

        WHERE id = @id

      `

      )

      .run({

        id: next.id,

        displayName: next.displayName,

        notifyEnabled: toBoolean(next.notifyEnabled),

      });



    return next;

  }



  deleteCreator(id: string): void {

    this.db.prepare(`DELETE FROM creators WHERE id = ?`).run(id);

  }



  listLiveStatus(): LiveStatus[] {

    const rows = this.db

      .prepare<unknown[], any>(

        `

        SELECT creator_id, is_live, title, game, started_at, viewer_count, stream_url, updated_at

        FROM live_status

      `

      )

      .all();

    return rows.map(mapLiveStatusRow);

  }



  upsertLiveStatus(payload: LiveStatusUpsert): LiveStatus {

    const data = liveStatusUpsertSchema.parse({

      ...payload,

      updatedAt: payload.updatedAt ?? SQLITE_DATE_FORMAT(),

    });



    this.db

      .prepare(

        `

        INSERT INTO live_status (creator_id, is_live, title, game, started_at, viewer_count, stream_url, updated_at)

        VALUES (@creatorId, @isLive, @title, @game, @startedAt, @viewerCount, @streamUrl, @updatedAt)

        ON CONFLICT(creator_id) DO UPDATE SET

          is_live = excluded.is_live,

          title = excluded.title,

          game = excluded.game,

          started_at = excluded.started_at,

          viewer_count = excluded.viewer_count,

          stream_url = excluded.stream_url,

          updated_at = excluded.updated_at

      `

      )

      .run({

        creatorId: data.creatorId,

        isLive: toBoolean(data.isLive),

        title: data.title ?? null,

        game: data.game ?? null,

        startedAt: data.startedAt ?? null,

        viewerCount: data.viewerCount ?? null,

        streamUrl: data.streamUrl ?? null,

        updatedAt: data.updatedAt,

      });



    const row = this.db

      .prepare<[string], any>(

        `

        SELECT creator_id, is_live, title, game, started_at, viewer_count, stream_url, updated_at

        FROM live_status

        WHERE creator_id = ?

      `

      )

      .get(data.creatorId);



    if (!row) {

      throw new Error("Failed to fetch live status after upsert");

    }



    return mapLiveStatusRow(row);

  }



  listCreatorsWithStatus(): Array<Creator & { liveStatus: LiveStatus | null }> {

    const rows = this.db

      .prepare<unknown[], any>(

        `

        SELECT

          c.id,

          c.platform,

          c.channel_id,

          c.display_name,

          c.notify_enabled,

          c.created_at,

          ls.is_live,

          ls.title,

          ls.game,

          ls.started_at,

          ls.viewer_count,

          ls.stream_url,

          ls.updated_at

        FROM creators c

        LEFT JOIN live_status ls ON ls.creator_id = c.id

        ORDER BY ls.is_live DESC NULLS LAST, c.created_at DESC

      `

      )

      .all();



    return rows.map((row: any) => {

      const creator = mapCreatorRow({

        id: row.id,

        platform: row.platform,

        channel_id: row.channel_id,

        display_name: row.display_name,

        notify_enabled: row.notify_enabled,

        created_at: row.created_at,

      });



      const liveStatus =

        typeof row.is_live === "number"

          ? mapLiveStatusRow({

              creator_id: row.id,

              is_live: row.is_live,

              title: row.title,

              game: row.game,

              started_at: row.started_at,

              viewer_count: row.viewer_count,

              stream_url: row.stream_url,

              updated_at: row.updated_at,

            })

          : null;



      return { ...creator, liveStatus };

    });

  }



  listUrlSets(): UrlSet[] {

    const rows = this.db

      .prepare<unknown[], any>(

        `

        SELECT id, name, urls, created_at, last_used_at

        FROM url_sets

        ORDER BY COALESCE(last_used_at, created_at) DESC

      `

      )

      .all();

    return rows.map(mapUrlSetRow);

  }



  saveUrlSet(input: UrlSetInsert): UrlSet {

    const normalized = {

      ...input,

      id: input.id ?? randomUUID(),

      createdAt: input.createdAt ?? SQLITE_DATE_FORMAT(),

      lastUsedAt: input.lastUsedAt ?? null,

    };



    const payload = urlSetInsertSchema.parse(normalized);

    const id = normalized.id;



    this.db

      .prepare(

        `

        INSERT INTO url_sets (id, name, urls, created_at, last_used_at)

        VALUES (@id, @name, @urls, @createdAt, @lastUsedAt)

        ON CONFLICT(id) DO UPDATE SET

          name = excluded.name,

          urls = excluded.urls,

          last_used_at = excluded.last_used_at

      `

      )

      .run({

        id,

        name: payload.name,

        urls: JSON.stringify(payload.urls),

        createdAt: payload.createdAt ?? normalized.createdAt,

        lastUsedAt: payload.lastUsedAt ?? normalized.lastUsedAt,

      });



    const row = this.db

      .prepare<[string], any>(

        `

        SELECT id, name, urls, created_at, last_used_at

        FROM url_sets

        WHERE id = ?

      `

      )

      .get(id);



    if (!row) {

      throw new Error("Failed to load URL set after upsert");

    }



    return mapUrlSetRow(row);

  }



  deleteUrlSet(id: string): void {

    this.db.prepare(`DELETE FROM url_sets WHERE id = ?`).run(id);

  }



  touchUrlSet(id: string): UrlSet | undefined {

    const timestamp = SQLITE_DATE_FORMAT();

    this.db

      .prepare(

        `

        UPDATE url_sets

        SET last_used_at = @timestamp

        WHERE id = @id

      `

      )

      .run({ id, timestamp });



    const row = this.db

      .prepare<[string], any>(

        `SELECT id, name, urls, created_at, last_used_at FROM url_sets WHERE id = ?`

      )

      .get(id);



    return row ? mapUrlSetRow(row) : undefined;

  }



  getSetting<TValue = unknown>(key: string): TValue | undefined {

    const row = this.db

      .prepare<[string], any>(`SELECT key, value FROM settings WHERE key = ?`)

      .get(key);

    if (!row) {

      return undefined;

    }

    const parsed = mapSettingRow(row);

    return parsed.value as TValue;

  }



  setSetting<TValue>(key: string, value: TValue): TValue {

    const payload = settingSchema.parse({

      key,

      value,

    });



    this.db

      .prepare(

        `

        INSERT INTO settings (key, value)

        VALUES (@key, @value)

        ON CONFLICT(key) DO UPDATE SET value = excluded.value

      `

      )

      .run({

        key: payload.key,

        value: JSON.stringify(payload.value),

      });



    return value;

  }

}



