CREATE TABLE "team_board_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"type" varchar DEFAULT 'note',
	"created_by" varchar NOT NULL,
	"created_by_name" varchar NOT NULL,
	"assigned_to" varchar,
	"assigned_to_name" varchar,
	"status" varchar DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "is_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "estimated_sandwich_count_min" integer;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "estimated_sandwich_count_max" integer;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "estimated_sandwich_range_type" varchar;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "pickup_time_window" text;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "pickup_person_responsible" text;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "speaker_audience_type" text;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "speaker_duration" text;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "delivery_time_window" text;--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN "delivery_parking_access" text;--> statement-breakpoint
ALTER TABLE "event_volunteers" ADD COLUMN "reminder_sent_at" timestamp;