import { z } from 'zod';

export const CREATOR_PLATFORMS = ['twitch', 'youtube'] as const;

export const creatorSchema = z.object({
  id: z.string().uuid(),
  platform: z.enum(CREATOR_PLATFORMS),
  channelId: z.string().min(1),
  displayName: z.string().min(1),
  notifyEnabled: z.boolean(),
  createdAt: z.string().datetime()
});

export const creatorInsertSchema = creatorSchema
  .omit({ id: true, createdAt: true })
  .extend({
    id: z.string().uuid().optional(),
    createdAt: z.string().datetime().optional(),
    notifyEnabled: z.boolean().optional().default(true)
  })
  .strict();

export const liveStatusSchema = z.object({
  creatorId: z.string().uuid(),
  isLive: z.boolean(),
  title: z.string().nullable(),
  game: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  viewerCount: z.number().int().nullable(),
  updatedAt: z.string().datetime()
});

export const liveStatusUpsertSchema = liveStatusSchema.extend({
  updatedAt: liveStatusSchema.shape.updatedAt.optional()
});

export const urlSetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  urls: z.array(z.string().url()),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable()
});

export const urlSetInsertSchema = urlSetSchema
  .omit({ id: true, createdAt: true, lastUsedAt: true })
  .extend({
    id: z.string().uuid().optional(),
    createdAt: z.string().datetime().optional(),
    lastUsedAt: z.string().datetime().nullable().optional()
  });

export const settingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown()
});

export type Creator = z.infer<typeof creatorSchema>;
export type CreatorInsert = z.infer<typeof creatorInsertSchema>;
export type LiveStatus = z.infer<typeof liveStatusSchema>;
export type LiveStatusUpsert = z.infer<typeof liveStatusUpsertSchema>;
export type UrlSet = z.infer<typeof urlSetSchema>;
export type UrlSetInsert = z.infer<typeof urlSetInsertSchema>;
export type Setting = z.infer<typeof settingSchema>;
