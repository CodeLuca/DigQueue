import { relations } from "drizzle-orm";
import { bigint, boolean, customType, doublePrecision, integer, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";

const timestampMs = customType<{ data: Date; driverData: number }>({
  dataType() {
    return "bigint";
  },
  toDriver(value) {
    return value.getTime();
  },
  fromDriver(value) {
    return new Date(Number(value));
  },
});

export const labels = pgTable("labels", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id"),
  entityKind: text("entity_kind").notNull().default("label"),
  externalDiscogsId: bigint("external_discogs_id", { mode: "number" }),
  name: text("name").notNull(),
  discogsUrl: text("discogs_url").notNull(),
  blurb: text("blurb"),
  imageUrl: text("image_url"),
  notableReleasesJson: text("notable_releases_json").notNull().default("[]"),
  sourceType: text("source_type").notNull().default("workspace"),
  active: boolean("active").notNull().default(false),
  status: text("status").notNull().default("queued"),
  currentPage: integer("current_page").notNull().default(1),
  totalPages: integer("total_pages").notNull().default(1),
  retryCount: integer("retry_count").notNull().default(0),
  lastError: text("last_error"),
  addedAt: timestampMs("added_at").notNull(),
  updatedAt: timestampMs("updated_at").notNull(),
});

export const releases = pgTable("releases", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id"),
  labelId: bigint("label_id", { mode: "number" }).notNull().references(() => labels.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  artist: text("artist").notNull().default("Unknown Artist"),
  year: integer("year"),
  catno: text("catno"),
  discogsUrl: text("discogs_url").notNull(),
  thumbUrl: text("thumb_url"),
  detailsFetched: boolean("details_fetched").notNull().default(false),
  youtubeMatched: boolean("youtube_matched").notNull().default(false),
  listened: boolean("listened").notNull().default(false),
  wishlist: boolean("wishlist").notNull().default(false),
  matchConfidence: doublePrecision("match_confidence").notNull().default(0),
  processingError: text("processing_error"),
  fetchedAt: timestampMs("fetched_at").notNull(),
  releaseOrder: integer("release_order").notNull().default(0),
  importSource: text("import_source").notNull().default("label"),
});

export const tracks = pgTable("tracks", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  userId: uuid("user_id"),
  releaseId: bigint("release_id", { mode: "number" }).notNull().references(() => releases.id, { onDelete: "cascade" }),
  position: text("position").notNull(),
  title: text("title").notNull(),
  duration: text("duration"),
  artistsText: text("artists_text"),
  listened: boolean("listened").notNull().default(false),
  saved: boolean("saved").notNull().default(false),
  wishlist: boolean("wishlist").notNull().default(false),
  createdAt: timestampMs("created_at").notNull(),
});

export const youtubeMatches = pgTable("youtube_matches", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  userId: uuid("user_id"),
  trackId: bigint("track_id", { mode: "number" }).notNull().references(() => tracks.id, { onDelete: "cascade" }),
  videoId: text("video_id").notNull(),
  title: text("title").notNull(),
  channelTitle: text("channel_title").notNull(),
  score: doublePrecision("score").notNull().default(0),
  embeddable: boolean("embeddable").notNull().default(true),
  chosen: boolean("chosen").notNull().default(false),
  fetchedAt: timestampMs("fetched_at").notNull(),
});

export const queueItems = pgTable("queue_items", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  userId: uuid("user_id"),
  youtubeVideoId: text("youtube_video_id").notNull(),
  trackId: bigint("track_id", { mode: "number" }).references(() => tracks.id, { onDelete: "set null" }),
  releaseId: bigint("release_id", { mode: "number" }).references(() => releases.id, { onDelete: "set null" }),
  labelId: bigint("label_id", { mode: "number" }).references(() => labels.id, { onDelete: "set null" }),
  source: text("source").notNull().default("track"),
  priority: integer("priority").notNull().default(0),
  bumpedAt: timestampMs("bumped_at"),
  status: text("status").notNull().default("pending"),
  addedAt: timestampMs("added_at").notNull(),
});

export const feedbackEvents = pgTable("feedback_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  userId: uuid("user_id"),
  trackId: bigint("track_id", { mode: "number" }).references(() => tracks.id, { onDelete: "set null" }),
  releaseId: bigint("release_id", { mode: "number" }).references(() => releases.id, { onDelete: "set null" }),
  labelId: bigint("label_id", { mode: "number" }).references(() => labels.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  eventValue: doublePrecision("event_value").notNull().default(1),
  source: text("source").notNull().default("app"),
  createdAt: timestampMs("created_at").notNull(),
});

export const releaseSignals = pgTable("release_signals", {
  releaseId: bigint("release_id", { mode: "number" }).primaryKey().references(() => releases.id, { onDelete: "cascade" }),
  userId: uuid("user_id"),
  primaryArtist: text("primary_artist"),
  stylesText: text("styles_text").notNull().default(""),
  genresText: text("genres_text").notNull().default(""),
  contributorsText: text("contributors_text").notNull().default(""),
  companiesText: text("companies_text").notNull().default(""),
  formatText: text("format_text").notNull().default(""),
  country: text("country"),
  year: integer("year"),
  updatedAt: timestampMs("updated_at").notNull(),
});

export const sourceReleases = pgTable(
  "source_releases",
  {
    sourceId: bigint("source_id", { mode: "number" }).notNull().references(() => labels.id, { onDelete: "cascade" }),
    releaseId: bigint("release_id", { mode: "number" }).notNull().references(() => releases.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    releaseOrder: integer("release_order").notNull().default(0),
    discoveredAt: timestampMs("discovered_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sourceId, table.releaseId] }),
  }),
);

export const apiCache = pgTable("api_cache", {
  key: text("key").primaryKey(),
  userId: uuid("user_id"),
  responseJson: text("response_json").notNull(),
  fetchedAt: timestampMs("fetched_at").notNull(),
  expiresAt: timestampMs("expires_at").notNull(),
});

export const appSecrets = pgTable("app_secrets", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id"),
  discogsToken: text("discogs_token"),
  youtubeApiKey: text("youtube_api_key"),
  youtubeOauthRefreshToken: text("youtube_oauth_refresh_token"),
  youtubeOauthAccessToken: text("youtube_oauth_access_token"),
  youtubeOauthExpiresAt: bigint("youtube_oauth_expires_at", { mode: "number" }),
  youtubeOauthScope: text("youtube_oauth_scope"),
  youtubeOauthChannelId: text("youtube_oauth_channel_id"),
  youtubeOauthChannelTitle: text("youtube_oauth_channel_title"),
  updatedAt: timestampMs("updated_at").notNull(),
});

export const workerLocks = pgTable("worker_locks", {
  lockKey: text("lock_key").primaryKey(),
  userId: uuid("user_id").notNull(),
  sourceId: bigint("source_id", { mode: "number" }).notNull(),
  leaseToken: text("lease_token").notNull(),
  lockedUntil: timestampMs("locked_until").notNull(),
  updatedAt: timestampMs("updated_at").notNull(),
});

export const apiRateLimits = pgTable("api_rate_limits", {
  bucketKey: text("bucket_key").primaryKey(),
  userId: uuid("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  requestCount: integer("request_count").notNull().default(0),
  windowStartedAt: timestampMs("window_started_at").notNull(),
  resetAt: timestampMs("reset_at").notNull(),
  updatedAt: timestampMs("updated_at").notNull(),
});

export const labelsRelations = relations(labels, ({ many }) => ({
  releases: many(releases),
  sourceReleases: many(sourceReleases),
}));

export const releasesRelations = relations(releases, ({ one, many }) => ({
  label: one(labels, { fields: [releases.labelId], references: [labels.id] }),
  tracks: many(tracks),
  signals: one(releaseSignals, { fields: [releases.id], references: [releaseSignals.releaseId] }),
  sourceReleases: many(sourceReleases),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  release: one(releases, { fields: [tracks.releaseId], references: [releases.id] }),
  matches: many(youtubeMatches),
}));

export const youtubeMatchesRelations = relations(youtubeMatches, ({ one }) => ({
  track: one(tracks, { fields: [youtubeMatches.trackId], references: [tracks.id] }),
}));

export const queueItemsRelations = relations(queueItems, ({ one }) => ({
  track: one(tracks, { fields: [queueItems.trackId], references: [tracks.id] }),
  release: one(releases, { fields: [queueItems.releaseId], references: [releases.id] }),
  label: one(labels, { fields: [queueItems.labelId], references: [labels.id] }),
}));

export const feedbackEventsRelations = relations(feedbackEvents, ({ one }) => ({
  track: one(tracks, { fields: [feedbackEvents.trackId], references: [tracks.id] }),
  release: one(releases, { fields: [feedbackEvents.releaseId], references: [releases.id] }),
  label: one(labels, { fields: [feedbackEvents.labelId], references: [labels.id] }),
}));

export const releaseSignalsRelations = relations(releaseSignals, ({ one }) => ({
  release: one(releases, { fields: [releaseSignals.releaseId], references: [releases.id] }),
}));

export const sourceReleasesRelations = relations(sourceReleases, ({ one }) => ({
  source: one(labels, { fields: [sourceReleases.sourceId], references: [labels.id] }),
  release: one(releases, { fields: [sourceReleases.releaseId], references: [releases.id] }),
}));
