ALTER TABLE app_secrets ADD COLUMN youtube_oauth_refresh_token text;
--> statement-breakpoint
ALTER TABLE app_secrets ADD COLUMN youtube_oauth_access_token text;
--> statement-breakpoint
ALTER TABLE app_secrets ADD COLUMN youtube_oauth_expires_at bigint;
--> statement-breakpoint
ALTER TABLE app_secrets ADD COLUMN youtube_oauth_scope text;
--> statement-breakpoint
ALTER TABLE app_secrets ADD COLUMN youtube_oauth_channel_id text;
--> statement-breakpoint
ALTER TABLE app_secrets ADD COLUMN youtube_oauth_channel_title text;
