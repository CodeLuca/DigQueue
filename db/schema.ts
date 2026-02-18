import { relations } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const labels = sqliteTable("labels", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  discogsUrl: text("discogs_url").notNull(),
  blurb: text("blurb"),
  imageUrl: text("image_url"),
  notableReleasesJson: text("notable_releases_json").notNull().default("[]"),
  sourceType: text("source_type").notNull().default("workspace"),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("queued"),
  currentPage: integer("current_page").notNull().default(1),
  totalPages: integer("total_pages").notNull().default(1),
  retryCount: integer("retry_count").notNull().default(0),
  lastError: text("last_error"),
  addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const releases = sqliteTable("releases", {
  id: integer("id").primaryKey(),
  labelId: integer("label_id").notNull().references(() => labels.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  artist: text("artist").notNull().default("Unknown Artist"),
  year: integer("year"),
  catno: text("catno"),
  discogsUrl: text("discogs_url").notNull(),
  thumbUrl: text("thumb_url"),
  detailsFetched: integer("details_fetched", { mode: "boolean" }).notNull().default(false),
  youtubeMatched: integer("youtube_matched", { mode: "boolean" }).notNull().default(false),
  listened: integer("listened", { mode: "boolean" }).notNull().default(false),
  wishlist: integer("wishlist", { mode: "boolean" }).notNull().default(false),
  matchConfidence: real("match_confidence").notNull().default(0),
  processingError: text("processing_error"),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  releaseOrder: integer("release_order").notNull().default(0),
  importSource: text("import_source").notNull().default("label"),
});

export const tracks = sqliteTable("tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  releaseId: integer("release_id").notNull().references(() => releases.id, { onDelete: "cascade" }),
  position: text("position").notNull(),
  title: text("title").notNull(),
  duration: text("duration"),
  artistsText: text("artists_text"),
  listened: integer("listened", { mode: "boolean" }).notNull().default(false),
  saved: integer("saved", { mode: "boolean" }).notNull().default(false),
  wishlist: integer("wishlist", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const youtubeMatches = sqliteTable("youtube_matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" }),
  videoId: text("video_id").notNull(),
  title: text("title").notNull(),
  channelTitle: text("channel_title").notNull(),
  score: real("score").notNull().default(0),
  embeddable: integer("embeddable", { mode: "boolean" }).notNull().default(true),
  chosen: integer("chosen", { mode: "boolean" }).notNull().default(false),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
});

export const queueItems = sqliteTable("queue_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  youtubeVideoId: text("youtube_video_id").notNull(),
  trackId: integer("track_id").references(() => tracks.id, { onDelete: "set null" }),
  releaseId: integer("release_id").references(() => releases.id, { onDelete: "set null" }),
  labelId: integer("label_id").references(() => labels.id, { onDelete: "set null" }),
  source: text("source").notNull().default("track"),
  priority: integer("priority").notNull().default(0),
  bumpedAt: integer("bumped_at", { mode: "timestamp_ms" }),
  status: text("status").notNull().default("pending"),
  addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
});

export const feedbackEvents = sqliteTable("feedback_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: integer("track_id").references(() => tracks.id, { onDelete: "set null" }),
  releaseId: integer("release_id").references(() => releases.id, { onDelete: "set null" }),
  labelId: integer("label_id").references(() => labels.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  eventValue: real("event_value").notNull().default(1),
  source: text("source").notNull().default("app"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const releaseSignals = sqliteTable("release_signals", {
  releaseId: integer("release_id").primaryKey().references(() => releases.id, { onDelete: "cascade" }),
  primaryArtist: text("primary_artist"),
  stylesText: text("styles_text").notNull().default(""),
  genresText: text("genres_text").notNull().default(""),
  contributorsText: text("contributors_text").notNull().default(""),
  companiesText: text("companies_text").notNull().default(""),
  formatText: text("format_text").notNull().default(""),
  country: text("country"),
  year: integer("year"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const apiCache = sqliteTable("api_cache", {
  key: text("key").primaryKey(),
  responseJson: text("response_json").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const appSecrets = sqliteTable("app_secrets", {
  id: integer("id").primaryKey(),
  discogsToken: text("discogs_token"),
  youtubeApiKey: text("youtube_api_key"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const labelsRelations = relations(labels, ({ many }) => ({
  releases: many(releases),
}));

export const releasesRelations = relations(releases, ({ one, many }) => ({
  label: one(labels, { fields: [releases.labelId], references: [labels.id] }),
  tracks: many(tracks),
  signals: one(releaseSignals, { fields: [releases.id], references: [releaseSignals.releaseId] }),
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
