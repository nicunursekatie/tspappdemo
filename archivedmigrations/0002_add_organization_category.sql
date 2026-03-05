-- Add department, category, schoolClassification, and isReligious fields to organizations table
ALTER TABLE "organizations" ADD COLUMN "department" varchar;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "category" varchar;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "school_classification" varchar;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "is_religious" boolean DEFAULT false;