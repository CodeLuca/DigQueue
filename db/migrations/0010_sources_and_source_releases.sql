ALTER TABLE labels ADD COLUMN entity_kind text NOT NULL DEFAULT 'label';
--> statement-breakpoint
ALTER TABLE labels ADD COLUMN external_discogs_id bigint;
--> statement-breakpoint
UPDATE labels
SET external_discogs_id = CASE
  WHEN id >= 1000000000 THEN id % 1000000000
  WHEN id > 0 THEN id
  ELSE NULL
END
WHERE external_discogs_id IS NULL;
--> statement-breakpoint
UPDATE labels
SET entity_kind = CASE
  WHEN lower(discogs_url) LIKE '%/artist/%' THEN 'artist'
  ELSE 'label'
END;
--> statement-breakpoint
CREATE TABLE source_releases (
  source_id bigint NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  release_id bigint NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  release_order integer NOT NULL DEFAULT 0,
  discovered_at bigint NOT NULL,
  PRIMARY KEY(source_id, release_id)
);
--> statement-breakpoint
INSERT INTO source_releases (source_id, release_id, user_id, release_order, discovered_at)
SELECT
  r.label_id,
  r.id,
  r.user_id,
  COALESCE(r.release_order, 0),
  COALESCE(r.fetched_at, (extract(epoch from now())::bigint * 1000))
FROM releases r
WHERE r.label_id IS NOT NULL
ON CONFLICT (source_id, release_id) DO NOTHING;
--> statement-breakpoint
CREATE INDEX source_releases_source_idx ON source_releases(source_id, release_order);
--> statement-breakpoint
CREATE INDEX source_releases_release_idx ON source_releases(release_id);
--> statement-breakpoint
CREATE INDEX source_releases_user_source_idx ON source_releases(user_id, source_id);
--> statement-breakpoint
CREATE INDEX labels_entity_kind_idx ON labels(entity_kind);
--> statement-breakpoint
CREATE INDEX labels_external_discogs_id_idx ON labels(external_discogs_id);
