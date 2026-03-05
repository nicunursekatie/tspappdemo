-- Create dashboard_documents table for managing important documents on dashboard
CREATE TABLE IF NOT EXISTS "dashboard_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" varchar NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"added_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dashboard_documents_document_id_unique" UNIQUE("document_id")
);
