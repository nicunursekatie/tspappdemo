-- Generated from production database on 2025-12-07T21:52:28.894Z
-- Run this SQL against a FRESH/EMPTY dev database
-- If database has existing tables, drop them first or use a new database

-- SEQUENCES
CREATE SEQUENCE IF NOT EXISTS "_migrations_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "activity_attachments_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "activity_participants_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "activity_reactions_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "agenda_items_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "agenda_sections_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "alert_requests_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "announcements_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "archived_projects_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "audit_logs_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "authoritative_weekly_collections_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "availability_slots_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "chat_message_likes_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "chat_message_reads_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "chat_messages_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "committee_memberships_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "committees_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "compiled_agendas_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "confidential_documents_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "contacts_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "conversations_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "cooler_inventory_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "cooler_types_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "dashboard_documents_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "dismissed_announcements_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "document_access_logs_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "document_permissions_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "documents_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "drive_links_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "driver_agreements_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "drivers_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "email_drafts_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "email_messages_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "event_collaboration_comment_likes_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "event_collaboration_comments_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "event_edit_revisions_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "event_field_locks_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "event_reminders_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "event_requests_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "event_volunteers_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "expenses_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "feature_flags_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "google_sheets_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "holding_zone_categories_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "host_contacts_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "hosted_files_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "hosts_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "impact_reports_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "imported_external_ids_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "kudos_tracking_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "meeting_minutes_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "meeting_notes_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "meeting_projects_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "meetings_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "message_likes_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "message_recipients_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "messages_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "notification_ab_tests_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "notification_action_history_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "notification_analytics_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "notification_history_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "notification_preferences_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "notification_rules_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "notifications_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "onboarding_challenges_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "onboarding_progress_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "organization_engagement_scores_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "organizations_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "project_assignments_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "project_comments_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "project_documents_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "project_tasks_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "projects_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "promotion_graphics_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "recipient_tsp_contacts_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "recipients_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "resource_tag_assignments_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "resource_tags_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "resources_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "sandwich_collections_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "sandwich_distributions_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "search_analytics_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "stream_channels_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "stream_messages_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "stream_threads_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "stream_users_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "suggestion_responses_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "suggestions_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "task_assignments_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "task_completions_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "team_board_assignments_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "team_board_comments_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "team_board_item_likes_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "team_board_items_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "user_activity_logs_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "user_notification_patterns_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "user_resource_favorites_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "volunteers_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "weekly_reports_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "wishlist_suggestions_id_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "work_logs_id_seq" START 1;

-- TABLES
CREATE TABLE IF NOT EXISTS "_migrations" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('_migrations_id_seq'::regclass),
  "name" VARCHAR(255) NOT NULL,
  "executed_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "activities" (
  "id" VARCHAR PRIMARY KEY,
  "type" VARCHAR(50) NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "created_by" VARCHAR NOT NULL,
  "assigned_to" JSONB DEFAULT '[]'::jsonb,
  "status" VARCHAR(50),
  "priority" VARCHAR(20),
  "parent_id" VARCHAR,
  "root_id" VARCHAR,
  "context_type" VARCHAR(50),
  "context_id" VARCHAR,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "is_deleted" BOOL DEFAULT false,
  "thread_count" INT4 DEFAULT 0,
  "last_activity_at" TIMESTAMP DEFAULT now(),
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "activity_attachments" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('activity_attachments_id_seq'::regclass),
  "activity_id" VARCHAR NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_type" VARCHAR(100),
  "file_name" TEXT NOT NULL,
  "file_size" INT4,
  "uploaded_by" VARCHAR NOT NULL,
  "uploaded_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "activity_participants" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('activity_participants_id_seq'::regclass),
  "activity_id" VARCHAR NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "role" VARCHAR(50) NOT NULL,
  "last_read_at" TIMESTAMP,
  "notifications_enabled" BOOL DEFAULT true,
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "activity_reactions" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('activity_reactions_id_seq'::regclass),
  "activity_id" VARCHAR NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "reaction_type" VARCHAR(50) NOT NULL,
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "agenda_items" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('agenda_items_id_seq'::regclass),
  "meeting_id" INT4 NOT NULL,
  "submitted_by" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "section" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "submitted_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "agenda_sections" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('agenda_sections_id_seq'::regclass),
  "compiled_agenda_id" INT4 NOT NULL,
  "title" TEXT NOT NULL,
  "order_index" INT4 NOT NULL,
  "items" JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS "alert_requests" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('alert_requests_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "alert_description" TEXT NOT NULL,
  "preferred_channel" VARCHAR NOT NULL DEFAULT 'no_preference'::character varying,
  "frequency" VARCHAR NOT NULL DEFAULT 'immediate'::character varying,
  "additional_notes" TEXT,
  "status" VARCHAR NOT NULL DEFAULT 'pending'::character varying,
  "admin_notes" TEXT,
  "reviewed_by" VARCHAR,
  "reviewed_at" TIMESTAMP,
  "implemented_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "announcements" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('announcements_id_seq'::regclass),
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" VARCHAR NOT NULL DEFAULT 'general'::character varying,
  "priority" VARCHAR NOT NULL DEFAULT 'medium'::character varying,
  "start_date" TIMESTAMP NOT NULL,
  "end_date" TIMESTAMP NOT NULL,
  "is_active" BOOL NOT NULL DEFAULT true,
  "link" TEXT,
  "link_text" TEXT,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "archived_projects" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('archived_projects_id_seq'::regclass),
  "original_project_id" INT4 NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'medium'::text,
  "category" TEXT NOT NULL DEFAULT 'technology'::text,
  "assignee_id" INT4,
  "assignee_name" TEXT,
  "assignee_ids" JSONB DEFAULT '[]'::jsonb,
  "assignee_names" TEXT,
  "due_date" TEXT,
  "start_date" TEXT,
  "completion_date" TEXT NOT NULL,
  "progress_percentage" INT4 NOT NULL DEFAULT 100,
  "notes" TEXT,
  "requirements" TEXT,
  "deliverables" TEXT,
  "resources" TEXT,
  "blockers" TEXT,
  "tags" TEXT,
  "estimated_hours" INT4,
  "actual_hours" INT4,
  "budget" VARCHAR,
  "color" TEXT NOT NULL DEFAULT 'blue'::text,
  "created_by" VARCHAR,
  "created_by_name" VARCHAR,
  "created_at" TIMESTAMP NOT NULL,
  "completed_at" TIMESTAMP NOT NULL DEFAULT now(),
  "archived_at" TIMESTAMP NOT NULL DEFAULT now(),
  "archived_by" VARCHAR,
  "archived_by_name" VARCHAR,
  "google_sheet_row_id" TEXT
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('audit_logs_id_seq'::regclass),
  "action" VARCHAR NOT NULL,
  "table_name" VARCHAR NOT NULL,
  "record_id" VARCHAR NOT NULL,
  "old_data" TEXT,
  "new_data" TEXT,
  "user_id" VARCHAR,
  "ip_address" VARCHAR,
  "user_agent" TEXT,
  "session_id" VARCHAR,
  "timestamp" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "authoritative_weekly_collections" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('authoritative_weekly_collections_id_seq'::regclass),
  "week_date" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "sandwiches" INT4 NOT NULL,
  "week_of_year" INT4 NOT NULL,
  "week_of_program" INT4 NOT NULL,
  "year" INT4 NOT NULL,
  "imported_at" TIMESTAMP NOT NULL DEFAULT now(),
  "source_file" TEXT DEFAULT 'New Sandwich Totals Scott (5)_1761847323011.xlsx'::text
);

CREATE TABLE IF NOT EXISTS "availability_slots" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('availability_slots_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "start_at" TIMESTAMP NOT NULL,
  "end_at" TIMESTAMP NOT NULL,
  "status" VARCHAR NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chat_message_likes" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('chat_message_likes_id_seq'::regclass),
  "message_id" INT4,
  "user_id" VARCHAR NOT NULL,
  "user_name" VARCHAR NOT NULL,
  "liked_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chat_message_reads" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('chat_message_reads_id_seq'::regclass),
  "message_id" INT4,
  "user_id" VARCHAR NOT NULL,
  "channel" VARCHAR NOT NULL,
  "read_at" TIMESTAMP DEFAULT now(),
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('chat_messages_id_seq'::regclass),
  "channel" VARCHAR NOT NULL DEFAULT 'general'::character varying,
  "user_id" VARCHAR NOT NULL,
  "user_name" VARCHAR NOT NULL,
  "content" TEXT NOT NULL,
  "edited_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "committee_memberships" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('committee_memberships_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "committee_id" INT4 NOT NULL,
  "role" VARCHAR NOT NULL DEFAULT 'member'::character varying,
  "permissions" JSONB DEFAULT '[]'::jsonb,
  "joined_at" TIMESTAMP DEFAULT now(),
  "is_active" BOOL NOT NULL DEFAULT true,
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "committees" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('committees_id_seq'::regclass),
  "name" VARCHAR NOT NULL,
  "description" TEXT,
  "is_active" BOOL NOT NULL DEFAULT true,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "compiled_agendas" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('compiled_agendas_id_seq'::regclass),
  "meeting_id" INT4 NOT NULL,
  "title" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "sections" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "deferred_items" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "compiled_by" TEXT NOT NULL,
  "compiled_at" TIMESTAMP NOT NULL DEFAULT now(),
  "finalized_at" TIMESTAMP,
  "published_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "confidential_documents" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('confidential_documents_id_seq'::regclass),
  "file_name" VARCHAR NOT NULL,
  "original_name" VARCHAR NOT NULL,
  "file_path" VARCHAR NOT NULL,
  "allowed_emails" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "uploaded_by" VARCHAR NOT NULL,
  "uploaded_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contacts" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('contacts_id_seq'::regclass),
  "name" TEXT NOT NULL,
  "organization" TEXT,
  "role" TEXT,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "category" TEXT NOT NULL DEFAULT 'general'::text,
  "status" TEXT NOT NULL DEFAULT 'active'::text,
  "is_active" BOOL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "conversation_participants" (
  "conversation_id" INT4,
  "user_id" TEXT,
  "joined_at" TIMESTAMP DEFAULT now(),
  "last_read_at" TIMESTAMP DEFAULT now(),
  PRIMARY KEY ("conversation_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('conversations_id_seq'::regclass),
  "type" TEXT NOT NULL,
  "name" TEXT,
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "cooler_inventory" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('cooler_inventory_id_seq'::regclass),
  "host_home_id" VARCHAR NOT NULL,
  "cooler_type_id" INT4 NOT NULL,
  "quantity" INT4 NOT NULL DEFAULT 0,
  "notes" TEXT,
  "reported_at" TIMESTAMP NOT NULL DEFAULT now(),
  "reported_by" VARCHAR NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "cooler_types" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('cooler_types_id_seq'::regclass),
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "is_active" BOOL NOT NULL DEFAULT true,
  "sort_order" INT4 NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "dashboard_documents" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('dashboard_documents_id_seq'::regclass),
  "document_id" VARCHAR NOT NULL,
  "display_order" INT4 NOT NULL DEFAULT 0,
  "is_active" BOOL NOT NULL DEFAULT true,
  "added_by" VARCHAR,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "dismissed_announcements" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('dismissed_announcements_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "announcement_id" VARCHAR NOT NULL,
  "dismissed_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "document_access_logs" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('document_access_logs_id_seq'::regclass),
  "document_id" INT4 NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "user_name" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "ip_address" VARCHAR,
  "user_agent" TEXT,
  "session_id" VARCHAR,
  "accessed_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "document_permissions" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('document_permissions_id_seq'::regclass),
  "document_id" INT4 NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "permission_type" TEXT NOT NULL,
  "granted_by" VARCHAR NOT NULL,
  "granted_by_name" TEXT NOT NULL,
  "granted_at" TIMESTAMP NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMP,
  "notes" TEXT,
  "is_active" BOOL NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "documents" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('documents_id_seq'::regclass),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "file_name" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  "file_size" INT4 NOT NULL,
  "mime_type" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general'::text,
  "is_active" BOOL NOT NULL DEFAULT true,
  "uploaded_by" VARCHAR NOT NULL,
  "uploaded_by_name" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "drive_links" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('drive_links_id_seq'::regclass),
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "icon_color" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "driver_agreements" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('driver_agreements_id_seq'::regclass),
  "submitted_by" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "license_number" TEXT NOT NULL,
  "vehicle_info" TEXT NOT NULL,
  "emergency_contact" TEXT NOT NULL,
  "emergency_phone" TEXT NOT NULL,
  "agreement_accepted" BOOL NOT NULL DEFAULT false,
  "submitted_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "drivers" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('drivers_id_seq'::regclass),
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "is_active" BOOL NOT NULL DEFAULT true,
  "vehicle_type" TEXT,
  "license_number" TEXT,
  "availability" TEXT DEFAULT 'available'::text,
  "zone" TEXT,
  "area" TEXT,
  "route_description" TEXT,
  "host_location" TEXT,
  "host_id" INT4,
  "van_approved" BOOL NOT NULL DEFAULT false,
  "home_address" TEXT,
  "availability_notes" TEXT,
  "email_agreement_sent" BOOL NOT NULL DEFAULT false,
  "voicemail_left" BOOL NOT NULL DEFAULT false,
  "inactive_reason" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "is_weekly_driver" BOOL NOT NULL DEFAULT false,
  "latitude" TEXT,
  "longitude" TEXT,
  "geocoded_at" TIMESTAMP,
  "willing_to_speak" BOOL NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "email_drafts" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('email_drafts_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "recipient_id" VARCHAR NOT NULL,
  "recipient_name" VARCHAR NOT NULL,
  "subject" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "last_saved" TIMESTAMP DEFAULT now(),
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_messages" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('email_messages_id_seq'::regclass),
  "sender_id" VARCHAR NOT NULL,
  "sender_name" VARCHAR NOT NULL,
  "sender_email" VARCHAR NOT NULL,
  "recipient_id" VARCHAR NOT NULL,
  "recipient_name" VARCHAR NOT NULL,
  "recipient_email" VARCHAR NOT NULL,
  "subject" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "is_read" BOOL NOT NULL DEFAULT false,
  "is_starred" BOOL NOT NULL DEFAULT false,
  "is_archived" BOOL NOT NULL DEFAULT false,
  "is_trashed" BOOL NOT NULL DEFAULT false,
  "is_draft" BOOL NOT NULL DEFAULT false,
  "parent_message_id" INT4,
  "context_type" VARCHAR,
  "context_id" VARCHAR,
  "context_title" VARCHAR,
  "attachments" TEXT[],
  "include_scheduling_link" BOOL DEFAULT false,
  "request_phone_call" BOOL DEFAULT false,
  "read_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "event_collaboration_comment_likes" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('event_collaboration_comment_likes_id_seq'::regclass),
  "comment_id" INT4 NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "event_collaboration_comments" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('event_collaboration_comments_id_seq'::regclass),
  "event_request_id" INT4 NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "user_name" VARCHAR NOT NULL,
  "content" TEXT NOT NULL,
  "parent_comment_id" INT4,
  "edited_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "event_edit_revisions" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('event_edit_revisions_id_seq'::regclass),
  "event_request_id" INT4 NOT NULL,
  "field_name" VARCHAR NOT NULL,
  "old_value" TEXT,
  "new_value" TEXT,
  "changed_by" VARCHAR NOT NULL,
  "changed_by_name" VARCHAR NOT NULL,
  "change_type" VARCHAR NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "event_field_locks" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('event_field_locks_id_seq'::regclass),
  "event_request_id" INT4 NOT NULL,
  "field_name" VARCHAR NOT NULL,
  "locked_by" VARCHAR NOT NULL,
  "locked_by_name" VARCHAR NOT NULL,
  "locked_at" TIMESTAMP NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "event_reminders" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('event_reminders_id_seq'::regclass),
  "event_request_id" INT4 NOT NULL,
  "title" VARCHAR NOT NULL,
  "description" TEXT,
  "reminder_type" VARCHAR NOT NULL,
  "due_date" TIMESTAMP NOT NULL,
  "assigned_to_user_id" VARCHAR,
  "assigned_to_name" VARCHAR,
  "status" VARCHAR NOT NULL DEFAULT 'pending'::character varying,
  "priority" VARCHAR NOT NULL DEFAULT 'medium'::character varying,
  "completed_at" TIMESTAMP,
  "completed_by" VARCHAR,
  "completion_notes" TEXT,
  "created_by" VARCHAR NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "event_requests" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('event_requests_id_seq'::regclass),
  "first_name" VARCHAR,
  "last_name" VARCHAR,
  "email" VARCHAR,
  "phone" VARCHAR,
  "organization_name" VARCHAR,
  "department" VARCHAR,
  "desired_event_date" TIMESTAMP,
  "scheduled_event_date" TIMESTAMP,
  "message" TEXT,
  "previously_hosted" VARCHAR NOT NULL DEFAULT 'i_dont_know'::character varying,
  "status" VARCHAR NOT NULL DEFAULT 'new'::character varying,
  "status_changed_at" TIMESTAMP,
  "assigned_to" VARCHAR,
  "follow_up_method" VARCHAR,
  "updated_email" VARCHAR,
  "follow_up_date" TIMESTAMP,
  "scheduled_call_date" TIMESTAMP,
  "contacted_at" TIMESTAMP,
  "communication_method" VARCHAR,
  "contact_completion_notes" TEXT,
  "event_address" TEXT,
  "estimated_sandwich_count" INT4,
  "has_refrigeration" BOOL,
  "completed_by_user_id" VARCHAR,
  "tsp_contact_assigned" VARCHAR,
  "tsp_contact" VARCHAR,
  "tsp_contact_assigned_date" TIMESTAMP,
  "additional_tsp_contacts" TEXT,
  "additional_contact_1" VARCHAR,
  "additional_contact_2" VARCHAR,
  "custom_tsp_contact" TEXT,
  "toolkit_sent" BOOL DEFAULT false,
  "toolkit_sent_date" TIMESTAMP,
  "toolkit_status" VARCHAR DEFAULT 'not_sent'::character varying,
  "toolkit_sent_by" VARCHAR,
  "event_start_time" VARCHAR,
  "event_end_time" VARCHAR,
  "pickup_time" VARCHAR,
  "pickup_date_time" VARCHAR,
  "additional_requirements" TEXT,
  "planning_notes" TEXT,
  "scheduling_notes" TEXT,
  "sandwich_types" JSONB,
  "delivery_destination" TEXT,
  "overnight_holding_location" TEXT,
  "overnight_pickup_time" TIME,
  "drivers_needed" INT4 DEFAULT 0,
  "speakers_needed" INT4 DEFAULT 0,
  "volunteers_needed" INT4 DEFAULT 0,
  "volunteer_notes" TEXT,
  "assigned_driver_ids" TEXT[],
  "driver_pickup_time" VARCHAR,
  "driver_notes" TEXT,
  "drivers_arranged" BOOL DEFAULT false,
  "assigned_speaker_ids" TEXT[],
  "assigned_driver_speakers" TEXT[],
  "assigned_volunteer_ids" TEXT[],
  "assigned_recipient_ids" TEXT[],
  "van_driver_needed" BOOL DEFAULT false,
  "assigned_van_driver_id" TEXT,
  "custom_van_driver_name" TEXT,
  "van_driver_notes" TEXT,
  "follow_up_one_day_completed" BOOL DEFAULT false,
  "follow_up_one_day_date" TIMESTAMP,
  "follow_up_one_month_completed" BOOL DEFAULT false,
  "follow_up_one_month_date" TIMESTAMP,
  "follow_up_notes" TEXT,
  "social_media_post_requested" BOOL DEFAULT false,
  "social_media_post_requested_date" TIMESTAMP,
  "social_media_post_completed" BOOL DEFAULT false,
  "social_media_post_completed_date" TIMESTAMP,
  "social_media_post_notes" TEXT,
  "actual_attendance" INT4,
  "estimated_attendance" INT4,
  "attendance_recorded_date" TIMESTAMP,
  "attendance_recorded_by" VARCHAR,
  "attendance_notes" TEXT,
  "actual_sandwich_count" INT4,
  "actual_sandwich_types" JSONB,
  "actual_sandwich_count_recorded_date" TIMESTAMP,
  "actual_sandwich_count_recorded_by" VARCHAR,
  "sandwich_distributions" JSONB,
  "distribution_recorded_date" TIMESTAMP,
  "distribution_recorded_by" VARCHAR,
  "distribution_notes" TEXT,
  "organization_exists" BOOL NOT NULL DEFAULT false,
  "duplicate_check_date" TIMESTAMP,
  "duplicate_notes" TEXT,
  "contact_attempts" INT4 DEFAULT 0,
  "last_contact_attempt" TIMESTAMP,
  "is_unresponsive" BOOL DEFAULT false,
  "marked_unresponsive_at" TIMESTAMP,
  "marked_unresponsive_by" VARCHAR,
  "unresponsive_reason" TEXT,
  "contact_method" VARCHAR,
  "next_follow_up_date" TIMESTAMP,
  "unresponsive_notes" TEXT,
  "google_sheet_row_id" TEXT,
  "external_id" VARCHAR NOT NULL,
  "last_synced_at" TIMESTAMP,
  "driver_details" JSONB,
  "speaker_details" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "created_by" VARCHAR,
  "volunteer_count" INT4,
  "organization_category" VARCHAR,
  "school_classification" VARCHAR,
  "adult_count" INT4,
  "children_count" INT4,
  "estimated_sandwich_count_min" INT4,
  "estimated_sandwich_count_max" INT4,
  "estimated_sandwich_range_type" VARCHAR,
  "pickup_time_window" TEXT,
  "pickup_person_responsible" TEXT,
  "speaker_audience_type" TEXT,
  "speaker_duration" TEXT,
  "delivery_time_window" TEXT,
  "delivery_parking_access" TEXT,
  "is_confirmed" BOOL NOT NULL DEFAULT false,
  "added_to_official_sheet" BOOL NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMP,
  "deleted_by" VARCHAR,
  "backup_dates" JSONB,
  "latitude" VARCHAR,
  "longitude" VARCHAR,
  "is_mlk_day_event" BOOL DEFAULT false,
  "mlk_day_marked_at" TIMESTAMP,
  "mlk_day_marked_by" VARCHAR,
  "contact_attempts_log" JSONB,
  "version" INT4 NOT NULL DEFAULT 1,
  "auto_categories" JSONB,
  "categorized_at" TIMESTAMP,
  "categorized_by" VARCHAR,
  "postponement_reason" TEXT,
  "tentative_new_date" TIMESTAMP,
  "postponement_notes" TEXT,
  "self_transport" BOOL DEFAULT false,
  "attendance_adults" INT4,
  "attendance_teens" INT4,
  "attendance_kids" INT4,
  "past_date_notification_sent_at" TIMESTAMP,
  "backup_contact_first_name" VARCHAR,
  "backup_contact_last_name" VARCHAR,
  "backup_contact_email" VARCHAR,
  "backup_contact_phone" VARCHAR,
  "backup_contact_role" VARCHAR,
  "pre_event_flags" JSONB DEFAULT '[]'::jsonb,
  "partner_organizations" JSONB
);

CREATE TABLE IF NOT EXISTS "event_volunteers" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('event_volunteers_id_seq'::regclass),
  "event_request_id" INT4 NOT NULL,
  "volunteer_user_id" VARCHAR,
  "volunteer_name" VARCHAR,
  "volunteer_email" VARCHAR,
  "volunteer_phone" VARCHAR,
  "role" VARCHAR NOT NULL,
  "status" VARCHAR NOT NULL DEFAULT 'pending'::character varying,
  "notes" TEXT,
  "assigned_by" VARCHAR,
  "signed_up_at" TIMESTAMP NOT NULL DEFAULT now(),
  "confirmed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "reminder_sent_at" TIMESTAMP,
  "email_reminder_1_sent_at" TIMESTAMP,
  "email_reminder_2_sent_at" TIMESTAMP,
  "sms_reminder_1_sent_at" TIMESTAMP,
  "sms_reminder_2_sent_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('expenses_id_seq'::regclass),
  "context_type" VARCHAR(50),
  "context_id" INT4,
  "description" TEXT NOT NULL,
  "amount" NUMERIC(10,2) NOT NULL,
  "category" VARCHAR(100),
  "vendor" VARCHAR(255),
  "purchase_date" TIMESTAMP,
  "receipt_url" TEXT,
  "receipt_file_name" TEXT,
  "receipt_file_size" INT4,
  "uploaded_by" VARCHAR NOT NULL,
  "uploaded_at" TIMESTAMP DEFAULT now(),
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "status" VARCHAR(50) NOT NULL DEFAULT 'pending'::character varying,
  "notes" TEXT,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "feature_flags" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('feature_flags_id_seq'::regclass),
  "flag_name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "enabled" BOOL NOT NULL DEFAULT false,
  "enabled_for_users" JSONB DEFAULT '[]'::jsonb,
  "enabled_for_roles" JSONB DEFAULT '[]'::jsonb,
  "enabled_percentage" INT4 DEFAULT 0,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "google_sheets" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('google_sheets_id_seq'::regclass),
  "name" VARCHAR NOT NULL,
  "description" TEXT,
  "sheet_id" VARCHAR NOT NULL,
  "is_public" BOOL NOT NULL DEFAULT true,
  "embed_url" TEXT NOT NULL,
  "direct_url" TEXT NOT NULL,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "holding_zone_categories" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('holding_zone_categories_id_seq'::regclass),
  "name" VARCHAR(100) NOT NULL,
  "color" VARCHAR(50) NOT NULL,
  "created_by" VARCHAR NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "is_active" BOOL NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "host_contacts" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('host_contacts_id_seq'::regclass),
  "host_id" INT4 NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "is_primary" BOOL NOT NULL DEFAULT false,
  "notes" TEXT,
  "host_location" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "address" TEXT,
  "weekly_active" BOOL DEFAULT false,
  "last_scraped" TIMESTAMP,
  "latitude" NUMERIC,
  "longitude" NUMERIC,
  "geocoded_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "hosted_files" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('hosted_files_id_seq'::regclass),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "file_name" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  "file_size" INT4 NOT NULL,
  "mime_type" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general'::text,
  "uploaded_by" TEXT NOT NULL,
  "is_public" BOOL NOT NULL DEFAULT true,
  "download_count" INT4 NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "hosts" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('hosts_id_seq'::regclass),
  "name" TEXT NOT NULL,
  "address" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active'::text,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "latitude" NUMERIC,
  "longitude" NUMERIC,
  "geocoded_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "impact_reports" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('impact_reports_id_seq'::regclass),
  "report_type" VARCHAR(50) NOT NULL,
  "report_period" VARCHAR(50) NOT NULL,
  "start_date" TIMESTAMP NOT NULL,
  "end_date" TIMESTAMP NOT NULL,
  "title" TEXT NOT NULL,
  "executive_summary" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metrics" JSONB,
  "highlights" JSONB,
  "trends" JSONB,
  "generated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "generated_by" VARCHAR,
  "ai_model" VARCHAR(100),
  "generation_prompt" TEXT,
  "regeneration_count" INT4 DEFAULT 0,
  "status" VARCHAR(50) NOT NULL DEFAULT 'draft'::character varying,
  "published_at" TIMESTAMP,
  "published_by" VARCHAR,
  "pdf_url" TEXT,
  "pdf_generated_at" TIMESTAMP,
  "tags" TEXT[],
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "imported_external_ids" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('imported_external_ids_id_seq'::regclass),
  "external_id" VARCHAR NOT NULL,
  "imported_at" TIMESTAMP NOT NULL DEFAULT now(),
  "source_table" VARCHAR NOT NULL DEFAULT 'event_requests'::character varying,
  "notes" TEXT
);

CREATE TABLE IF NOT EXISTS "kudos_tracking" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('kudos_tracking_id_seq'::regclass),
  "sender_id" TEXT NOT NULL,
  "recipient_id" TEXT NOT NULL,
  "context_type" TEXT NOT NULL,
  "context_id" TEXT NOT NULL,
  "entity_name" TEXT NOT NULL DEFAULT 'Legacy Entry'::text,
  "message_id" INT4,
  "sent_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "meeting_minutes" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('meeting_minutes_id_seq'::regclass),
  "title" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'blue'::text,
  "file_name" TEXT,
  "file_path" TEXT,
  "file_type" TEXT,
  "mime_type" TEXT,
  "committee_type" TEXT
);

CREATE TABLE IF NOT EXISTS "meeting_notes" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('meeting_notes_id_seq'::regclass),
  "project_id" INT4,
  "meeting_id" INT4 NOT NULL,
  "type" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active'::text,
  "created_by" VARCHAR,
  "created_by_name" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "converted_to_task_id" INT4,
  "converted_at" TIMESTAMP,
  "selected_for_agenda" BOOL NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "meeting_projects" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('meeting_projects_id_seq'::regclass),
  "meeting_id" INT4 NOT NULL,
  "project_id" INT4 NOT NULL,
  "discussion_points" TEXT,
  "questions_to_address" TEXT,
  "discussion_summary" TEXT,
  "decisions_reached" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planned'::text,
  "include_in_agenda" BOOL NOT NULL DEFAULT true,
  "agenda_order" INT4,
  "section" TEXT,
  "added_at" TIMESTAMP NOT NULL DEFAULT now(),
  "added_by" VARCHAR,
  "discussed_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "meetings" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('meetings_id_seq'::regclass),
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "time" TEXT NOT NULL,
  "location" TEXT,
  "description" TEXT,
  "final_agenda" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planning'::text,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_likes" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('message_likes_id_seq'::regclass),
  "message_id" INT4 NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_name" TEXT,
  "liked_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_recipients" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('message_recipients_id_seq'::regclass),
  "message_id" INT4,
  "recipient_id" TEXT NOT NULL,
  "read" BOOL NOT NULL DEFAULT false,
  "read_at" TIMESTAMP,
  "notification_sent" BOOL NOT NULL DEFAULT false,
  "email_sent_at" TIMESTAMP,
  "context_access_revoked" BOOL DEFAULT false,
  "initially_notified" BOOL NOT NULL DEFAULT false,
  "initially_notified_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('messages_id_seq'::regclass),
  "conversation_id" INT4,
  "user_id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "sender" TEXT,
  "context_type" TEXT,
  "context_id" TEXT,
  "read" BOOL NOT NULL DEFAULT false,
  "edited_at" TIMESTAMP,
  "edited_content" TEXT,
  "deleted_at" TIMESTAMP,
  "deleted_by" TEXT,
  "reply_to_message_id" INT4,
  "reply_to_content" TEXT,
  "reply_to_sender" TEXT,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now(),
  "context_title" TEXT
);

CREATE TABLE IF NOT EXISTS "notification_ab_tests" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('notification_ab_tests_id_seq'::regclass),
  "name" VARCHAR NOT NULL,
  "description" TEXT,
  "hypothesis" TEXT,
  "test_type" VARCHAR NOT NULL,
  "category" VARCHAR,
  "type" VARCHAR,
  "control_group" JSONB NOT NULL,
  "test_group" JSONB NOT NULL,
  "traffic_split" INT4 NOT NULL DEFAULT 50,
  "status" VARCHAR NOT NULL DEFAULT 'draft'::character varying,
  "start_date" TIMESTAMP,
  "end_date" TIMESTAMP,
  "target_sample_size" INT4 DEFAULT 1000,
  "primary_metric" VARCHAR NOT NULL,
  "target_improvement" NUMERIC(5,2) DEFAULT 5.00,
  "significance_level" NUMERIC(3,2) DEFAULT 0.05,
  "control_results" JSONB DEFAULT '{}'::jsonb,
  "test_results" JSONB DEFAULT '{}'::jsonb,
  "statistical_significance" BOOL,
  "winner_variant" VARCHAR,
  "created_by" VARCHAR,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notification_action_history" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('notification_action_history_id_seq'::regclass),
  "notification_id" INT4 NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "action_type" VARCHAR NOT NULL,
  "action_status" VARCHAR NOT NULL DEFAULT 'pending'::character varying,
  "started_at" TIMESTAMP NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMP,
  "error_message" TEXT,
  "related_type" VARCHAR,
  "related_id" INT4,
  "undone_at" TIMESTAMP,
  "undone_by" VARCHAR,
  "metadata" JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS "notification_analytics" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('notification_analytics_id_seq'::regclass),
  "period_type" VARCHAR NOT NULL,
  "period_start" TIMESTAMP NOT NULL,
  "period_end" TIMESTAMP NOT NULL,
  "category" VARCHAR,
  "type" VARCHAR,
  "delivery_channel" VARCHAR,
  "total_sent" INT4 NOT NULL DEFAULT 0,
  "total_delivered" INT4 NOT NULL DEFAULT 0,
  "total_opened" INT4 NOT NULL DEFAULT 0,
  "total_clicked" INT4 NOT NULL DEFAULT 0,
  "total_dismissed" INT4 NOT NULL DEFAULT 0,
  "total_failed" INT4 NOT NULL DEFAULT 0,
  "delivery_rate" NUMERIC(5,2),
  "open_rate" NUMERIC(5,2),
  "click_rate" NUMERIC(5,2),
  "dismissal_rate" NUMERIC(5,2),
  "average_delivery_time" INT4,
  "average_response_time" INT4,
  "peak_hours" JSONB DEFAULT '[]'::jsonb,
  "insights" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notification_history" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('notification_history_id_seq'::regclass),
  "notification_id" INT4 NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "delivery_channel" VARCHAR NOT NULL,
  "delivery_status" VARCHAR NOT NULL DEFAULT 'pending'::character varying,
  "delivery_attempts" INT4 NOT NULL DEFAULT 0,
  "last_delivery_attempt" TIMESTAMP,
  "delivered_at" TIMESTAMP,
  "failure_reason" TEXT,
  "opened_at" TIMESTAMP,
  "clicked_at" TIMESTAMP,
  "dismissed_at" TIMESTAMP,
  "interaction_type" VARCHAR,
  "time_to_interaction" INT4,
  "relevance_score" NUMERIC(5,2),
  "context_metadata" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('notification_preferences_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "category" VARCHAR NOT NULL,
  "type" VARCHAR NOT NULL,
  "email_enabled" BOOL NOT NULL DEFAULT true,
  "sms_enabled" BOOL NOT NULL DEFAULT false,
  "in_app_enabled" BOOL NOT NULL DEFAULT true,
  "push_enabled" BOOL NOT NULL DEFAULT true,
  "priority" VARCHAR NOT NULL DEFAULT 'medium'::character varying,
  "frequency" VARCHAR NOT NULL DEFAULT 'immediate'::character varying,
  "quiet_hours_start" TIME,
  "quiet_hours_end" TIME,
  "timezone" VARCHAR DEFAULT 'America/New_York'::character varying,
  "relevance_score" NUMERIC(5,2) DEFAULT 50.00,
  "last_interaction" TIMESTAMP,
  "total_received" INT4 NOT NULL DEFAULT 0,
  "total_opened" INT4 NOT NULL DEFAULT 0,
  "total_dismissed" INT4 NOT NULL DEFAULT 0,
  "engagement_metadata" JSONB DEFAULT '{}'::jsonb,
  "is_active" BOOL NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notification_rules" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('notification_rules_id_seq'::regclass),
  "name" VARCHAR NOT NULL,
  "description" TEXT,
  "category" VARCHAR,
  "type" VARCHAR,
  "priority" VARCHAR,
  "user_role" VARCHAR,
  "batching_enabled" BOOL NOT NULL DEFAULT false,
  "batching_window" INT4 DEFAULT 3600,
  "max_batch_size" INT4 DEFAULT 5,
  "respect_quiet_hours" BOOL NOT NULL DEFAULT true,
  "min_time_between" INT4 DEFAULT 300,
  "max_daily_limit" INT4,
  "smart_channel_selection" BOOL NOT NULL DEFAULT true,
  "fallback_channel" VARCHAR DEFAULT 'in_app'::character varying,
  "retry_attempts" INT4 NOT NULL DEFAULT 3,
  "retry_delay" INT4 NOT NULL DEFAULT 3600,
  "test_variant" VARCHAR,
  "is_active" BOOL NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('notifications_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "type" VARCHAR NOT NULL,
  "priority" VARCHAR NOT NULL DEFAULT 'medium'::character varying,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "is_read" BOOL NOT NULL DEFAULT false,
  "is_archived" BOOL NOT NULL DEFAULT false,
  "category" VARCHAR,
  "related_type" VARCHAR,
  "related_id" INT4,
  "action_url" TEXT,
  "action_text" TEXT,
  "expires_at" TIMESTAMP,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "onboarding_challenges" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('onboarding_challenges_id_seq'::regclass),
  "action_key" VARCHAR NOT NULL,
  "title" VARCHAR NOT NULL,
  "description" TEXT,
  "category" VARCHAR NOT NULL,
  "points" INT4 NOT NULL DEFAULT 10,
  "icon" VARCHAR,
  "order" INT4 NOT NULL DEFAULT 0,
  "is_active" BOOL NOT NULL DEFAULT true,
  "created_at" TIMESTAMP DEFAULT now(),
  "promotion" TEXT
);

CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('onboarding_progress_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "challenge_id" INT4 NOT NULL,
  "completed_at" TIMESTAMP NOT NULL DEFAULT now(),
  "metadata" JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS "organization_engagement_scores" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('organization_engagement_scores_id_seq'::regclass),
  "organization_name" VARCHAR NOT NULL,
  "canonical_name" VARCHAR NOT NULL,
  "category" VARCHAR,
  "overall_engagement_score" NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  "frequency_score" NUMERIC(5,2) DEFAULT '0'::numeric,
  "recency_score" NUMERIC(5,2) DEFAULT '0'::numeric,
  "volume_score" NUMERIC(5,2) DEFAULT '0'::numeric,
  "completion_score" NUMERIC(5,2) DEFAULT '0'::numeric,
  "consistency_score" NUMERIC(5,2) DEFAULT '0'::numeric,
  "engagement_trend" VARCHAR DEFAULT 'stable'::character varying,
  "trend_percent_change" NUMERIC(5,2) DEFAULT '0'::numeric,
  "total_events" INT4 NOT NULL DEFAULT 0,
  "completed_events" INT4 NOT NULL DEFAULT 0,
  "total_sandwiches" INT4 NOT NULL DEFAULT 0,
  "days_since_last_event" INT4,
  "days_since_first_event" INT4,
  "last_event_date" TIMESTAMP,
  "first_event_date" TIMESTAMP,
  "average_event_interval" INT4,
  "engagement_level" VARCHAR NOT NULL DEFAULT 'unknown'::character varying,
  "outreach_priority" VARCHAR DEFAULT 'normal'::character varying,
  "recommended_actions" JSONB DEFAULT '[]'::jsonb,
  "insights" JSONB DEFAULT '[]'::jsonb,
  "program_suitability" JSONB DEFAULT '[]'::jsonb,
  "last_calculated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "calculation_version" VARCHAR DEFAULT '1.0'::character varying,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('organizations_id_seq'::regclass),
  "name" VARCHAR NOT NULL,
  "alternate_names" TEXT[],
  "addresses" TEXT[],
  "domains" TEXT[],
  "total_events" INT4 NOT NULL DEFAULT 0,
  "last_event_date" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "category" VARCHAR,
  "school_classification" VARCHAR,
  "is_religious" BOOL DEFAULT false,
  "department" VARCHAR
);

CREATE TABLE IF NOT EXISTS "project_assignments" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('project_assignments_id_seq'::regclass),
  "project_id" INT4 NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "added_at" TIMESTAMP NOT NULL DEFAULT now(),
  "added_by" VARCHAR
);

CREATE TABLE IF NOT EXISTS "project_comments" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('project_comments_id_seq'::regclass),
  "project_id" INT4 NOT NULL,
  "author_name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "comment_type" TEXT NOT NULL DEFAULT 'general'::text,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "project_documents" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('project_documents_id_seq'::regclass),
  "project_id" INT4 NOT NULL,
  "file_name" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "file_size" INT4 NOT NULL,
  "mime_type" TEXT NOT NULL,
  "uploaded_by" TEXT NOT NULL,
  "uploaded_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "project_tasks" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('project_tasks_id_seq'::regclass),
  "project_id" INT4,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "priority" TEXT NOT NULL DEFAULT 'medium'::text,
  "assignee_id" TEXT,
  "assignee_name" TEXT,
  "assignee_ids" TEXT[],
  "assignee_names" TEXT[],
  "due_date" TEXT,
  "completed_at" TIMESTAMP,
  "attachments" TEXT,
  "order" INT4 NOT NULL DEFAULT 0,
  "order_num" INT4 DEFAULT 0,
  "completed_by" TEXT,
  "completed_by_name" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "origin_type" TEXT NOT NULL DEFAULT 'manual'::text,
  "source_note_id" INT4,
  "source_meeting_id" INT4,
  "source_team_board_id" INT4,
  "selected_for_agenda" BOOL NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('projects_id_seq'::regclass),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'medium'::text,
  "category" TEXT NOT NULL DEFAULT 'technology'::text,
  "milestone" TEXT,
  "assignee_id" INT4,
  "assignee_name" TEXT,
  "assignee_ids" JSONB DEFAULT '[]'::jsonb,
  "assignee_names" TEXT,
  "support_people_ids" JSONB DEFAULT '[]'::jsonb,
  "support_people" TEXT,
  "due_date" TEXT,
  "start_date" TEXT,
  "completion_date" TEXT,
  "progress_percentage" INT4 NOT NULL DEFAULT 0,
  "notes" TEXT,
  "requirements" TEXT,
  "deliverables" TEXT,
  "resources" TEXT,
  "blockers" TEXT,
  "tags" TEXT,
  "estimated_hours" INT4,
  "actual_hours" INT4,
  "budget" VARCHAR,
  "color" TEXT NOT NULL DEFAULT 'blue'::text,
  "created_by" VARCHAR,
  "created_by_name" VARCHAR,
  "review_in_next_meeting" BOOL NOT NULL DEFAULT false,
  "last_discussed_date" TEXT,
  "meeting_discussion_points" TEXT,
  "meeting_decision_items" TEXT,
  "google_sheet_row_id" TEXT,
  "last_synced_at" TIMESTAMP,
  "sync_status" TEXT DEFAULT 'unsynced'::text,
  "last_pulled_from_sheet_at" TIMESTAMP,
  "last_pushed_to_sheet_at" TIMESTAMP,
  "last_sheet_hash" TEXT,
  "last_app_hash" TEXT,
  "tasks_and_owners" TEXT,
  "estimatedhours" INT4,
  "actualhours" INT4,
  "startdate" TEXT,
  "enddate" TEXT,
  "risklevel" VARCHAR,
  "stakeholders" TEXT,
  "milestones" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "owner_id" TEXT,
  "owner_name" TEXT
);

CREATE TABLE IF NOT EXISTS "promotion_graphics" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('promotion_graphics_id_seq'::regclass),
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "image_url" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_size" INT4,
  "file_type" VARCHAR(100),
  "intended_use_date" TIMESTAMP,
  "target_audience" TEXT DEFAULT 'hosts'::text,
  "status" VARCHAR(50) DEFAULT 'active'::character varying,
  "notification_sent" BOOL DEFAULT false,
  "notification_sent_at" TIMESTAMP,
  "uploaded_by" VARCHAR NOT NULL,
  "uploaded_by_name" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now(),
  "view_count" INT4 DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "recipient_tsp_contacts" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('recipient_tsp_contacts_id_seq'::regclass),
  "recipient_id" INT4 NOT NULL,
  "user_id" VARCHAR,
  "user_name" TEXT,
  "user_email" TEXT,
  "contact_name" TEXT,
  "contact_email" TEXT,
  "contact_phone" TEXT,
  "role" TEXT NOT NULL DEFAULT 'tsp_contact'::text,
  "notes" TEXT,
  "is_active" BOOL NOT NULL DEFAULT true,
  "is_primary" BOOL NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "recipients" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('recipients_id_seq'::regclass),
  "name" TEXT NOT NULL,
  "contact_name" TEXT,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "website" TEXT,
  "instagram_handle" TEXT,
  "address" TEXT,
  "region" TEXT,
  "preferences" TEXT,
  "weekly_estimate" INT4,
  "status" TEXT NOT NULL DEFAULT 'active'::text,
  "contact_person_name" TEXT,
  "contact_person_phone" TEXT,
  "contact_person_email" TEXT,
  "contact_person_role" TEXT,
  "second_contact_person_name" TEXT,
  "second_contact_person_phone" TEXT,
  "second_contact_person_email" TEXT,
  "second_contact_person_role" TEXT,
  "reporting_group" TEXT,
  "estimated_sandwiches" INT4,
  "sandwich_type" TEXT,
  "tsp_contact" TEXT,
  "tsp_contact_user_id" VARCHAR,
  "contract_signed" BOOL NOT NULL DEFAULT false,
  "contract_signed_date" TIMESTAMP,
  "collection_day" TEXT,
  "collection_time" TEXT,
  "feeding_day" TEXT,
  "feeding_time" TEXT,
  "has_shared_post" BOOL NOT NULL DEFAULT false,
  "shared_post_date" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "focus_areas" JSONB DEFAULT '[]'::jsonb,
  "focus_area" TEXT,
  "average_people_served" INT4,
  "people_served_frequency" TEXT,
  "partnership_start_date" TIMESTAMP,
  "partnership_years" INT4,
  "receiving_fruit" BOOL NOT NULL DEFAULT false,
  "receiving_snacks" BOOL NOT NULL DEFAULT false,
  "wants_fruit" BOOL NOT NULL DEFAULT false,
  "wants_snacks" BOOL NOT NULL DEFAULT false,
  "fruit_snacks_notes" TEXT,
  "has_seasonal_changes" BOOL NOT NULL DEFAULT false,
  "seasonal_changes_description" TEXT,
  "summer_needs" TEXT,
  "winter_needs" TEXT,
  "collection_schedules" JSONB DEFAULT '[]'::jsonb,
  "feeding_schedules" JSONB DEFAULT '[]'::jsonb,
  "allowed_contact_methods" JSONB DEFAULT '["text", "email"]'::jsonb,
  "do_not_contact" BOOL NOT NULL DEFAULT false,
  "contact_method_notes" TEXT,
  "impact_stories" JSONB DEFAULT '[]'::jsonb,
  "preferred_contact_methods" JSONB DEFAULT '[]'::jsonb,
  "latitude" NUMERIC,
  "longitude" NUMERIC,
  "geocoded_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "resource_tag_assignments" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('resource_tag_assignments_id_seq'::regclass),
  "resource_id" INT4 NOT NULL,
  "tag_id" INT4 NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "resource_tags" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('resource_tags_id_seq'::regclass),
  "name" TEXT NOT NULL,
  "color" TEXT,
  "description" TEXT,
  "created_by" VARCHAR NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "resources" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('resources_id_seq'::regclass),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "document_id" INT4,
  "url" TEXT,
  "icon" TEXT,
  "icon_color" TEXT,
  "is_pinned_global" BOOL NOT NULL DEFAULT false,
  "pinned_order" INT4,
  "access_count" INT4 NOT NULL DEFAULT 0,
  "last_accessed_at" TIMESTAMP,
  "created_by" VARCHAR NOT NULL,
  "created_by_name" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "is_active" BOOL NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "sandwich_collections" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('sandwich_collections_id_seq'::regclass),
  "collection_date" TEXT NOT NULL,
  "host_name" TEXT NOT NULL,
  "individual_sandwiches" INT4 NOT NULL DEFAULT 0,
  "group1_name" TEXT,
  "group1_count" INT4,
  "group2_name" TEXT,
  "group2_count" INT4,
  "group_collections" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_by" TEXT,
  "created_by_name" TEXT,
  "submitted_at" TIMESTAMP NOT NULL DEFAULT now(),
  "submission_method" TEXT DEFAULT 'standard'::text,
  "individual_deli" INT4,
  "individual_pbj" INT4,
  "individual_turkey" INT4,
  "individual_ham" INT4,
  "deleted_at" TIMESTAMP,
  "deleted_by" TEXT,
  "individual_generic" INT4,
  "event_request_id" INT4
);

CREATE TABLE IF NOT EXISTS "sandwich_distributions" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('sandwich_distributions_id_seq'::regclass),
  "distribution_date" TEXT NOT NULL,
  "week_ending" TEXT NOT NULL,
  "host_id" INT4 NOT NULL,
  "host_name" TEXT NOT NULL,
  "recipient_id" INT4 NOT NULL,
  "recipient_name" TEXT NOT NULL,
  "sandwich_count" INT4 NOT NULL,
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_by_name" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "search_analytics" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('search_analytics_id_seq'::regclass),
  "query" TEXT NOT NULL,
  "result_id" VARCHAR,
  "clicked" BOOL NOT NULL DEFAULT false,
  "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
  "user_id" VARCHAR,
  "user_role" VARCHAR,
  "used_ai" BOOL NOT NULL DEFAULT false,
  "results_count" INT4 NOT NULL DEFAULT 0,
  "query_time" INT4 NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" VARCHAR PRIMARY KEY,
  "sess" JSONB NOT NULL,
  "expire" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "stream_channels" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('stream_channels_id_seq'::regclass),
  "channel_id" VARCHAR NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "folder" VARCHAR NOT NULL DEFAULT 'inbox'::character varying,
  "last_read" TIMESTAMP,
  "custom_data" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "stream_messages" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('stream_messages_id_seq'::regclass),
  "stream_message_id" VARCHAR NOT NULL,
  "channel_id" VARCHAR NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "is_starred" BOOL NOT NULL DEFAULT false,
  "is_draft" BOOL NOT NULL DEFAULT false,
  "folder" VARCHAR NOT NULL DEFAULT 'inbox'::character varying,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "stream_threads" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('stream_threads_id_seq'::regclass),
  "stream_thread_id" VARCHAR NOT NULL,
  "parent_message_id" INT4,
  "title" TEXT,
  "participants" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "last_reply_at" TIMESTAMP,
  "reply_count" INT4 NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "stream_users" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('stream_users_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "stream_user_id" VARCHAR NOT NULL,
  "stream_token" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "suggestion_responses" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('suggestion_responses_id_seq'::regclass),
  "suggestion_id" INT4 NOT NULL,
  "message" TEXT NOT NULL,
  "is_admin_response" BOOL NOT NULL DEFAULT false,
  "responded_by" VARCHAR NOT NULL,
  "respondent_name" TEXT,
  "is_internal" BOOL NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "suggestions" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('suggestions_id_seq'::regclass),
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general'::text,
  "priority" TEXT NOT NULL DEFAULT 'medium'::text,
  "status" TEXT NOT NULL DEFAULT 'submitted'::text,
  "submitted_by" VARCHAR NOT NULL,
  "submitter_email" VARCHAR,
  "submitter_name" TEXT,
  "is_anonymous" BOOL NOT NULL DEFAULT false,
  "upvotes" INT4 NOT NULL DEFAULT 0,
  "tags" TEXT[] DEFAULT '{}'::text[],
  "implementation_notes" TEXT,
  "estimated_effort" TEXT,
  "assigned_to" VARCHAR,
  "completed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "task_assignments" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('task_assignments_id_seq'::regclass),
  "task_id" INT4 NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'assignee'::text,
  "added_at" TIMESTAMP NOT NULL DEFAULT now(),
  "added_by" VARCHAR
);

CREATE TABLE IF NOT EXISTS "task_completions" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('task_completions_id_seq'::regclass),
  "task_id" INT4 NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_name" TEXT NOT NULL,
  "completed_at" TIMESTAMP NOT NULL DEFAULT now(),
  "notes" TEXT
);

CREATE TABLE IF NOT EXISTS "team_board_assignments" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('team_board_assignments_id_seq'::regclass),
  "item_id" INT4 NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_name" TEXT NOT NULL,
  "added_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "team_board_comments" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('team_board_comments_id_seq'::regclass),
  "item_id" INT4 NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "user_name" VARCHAR NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "team_board_item_likes" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('team_board_item_likes_id_seq'::regclass),
  "item_id" INT4 NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "team_board_items" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('team_board_items_id_seq'::regclass),
  "content" TEXT NOT NULL,
  "type" VARCHAR DEFAULT 'task'::character varying,
  "created_by" VARCHAR NOT NULL,
  "created_by_name" VARCHAR NOT NULL,
  "assigned_to" TEXT[],
  "assigned_to_names" TEXT[],
  "status" VARCHAR NOT NULL DEFAULT 'open'::character varying,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMP,
  "project_id" INT4,
  "promoted_to_task_id" INT4,
  "promoted_at" TIMESTAMP,
  "category_id" INT4,
  "is_urgent" BOOL NOT NULL DEFAULT false,
  "is_private" BOOL NOT NULL DEFAULT false,
  "details" TEXT,
  "due_date" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "user_activity_logs" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('user_activity_logs_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "action" VARCHAR NOT NULL,
  "section" VARCHAR NOT NULL,
  "details" JSONB DEFAULT '{}'::jsonb,
  "session_id" VARCHAR,
  "ip_address" VARCHAR,
  "user_agent" TEXT,
  "duration" INT4,
  "page" VARCHAR,
  "feature" VARCHAR,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_notification_patterns" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('user_notification_patterns_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "most_active_hours" JSONB DEFAULT '[]'::jsonb,
  "most_active_days" JSONB DEFAULT '[]'::jsonb,
  "average_response_time" INT4,
  "preferred_channels" JSONB DEFAULT '[]'::jsonb,
  "overall_engagement_score" NUMERIC(5,2) DEFAULT 50.00,
  "category_engagement" JSONB DEFAULT '{}'::jsonb,
  "recent_engagement_trend" VARCHAR DEFAULT 'stable'::character varying,
  "last_model_update" TIMESTAMP,
  "model_version" VARCHAR DEFAULT '1.0'::character varying,
  "learning_metadata" JSONB DEFAULT '{}'::jsonb,
  "content_preferences" JSONB DEFAULT '{}'::jsonb,
  "timing_preferences" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_resource_favorites" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('user_resource_favorites_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "resource_id" INT4 NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" VARCHAR PRIMARY KEY,
  "email" VARCHAR,
  "password" VARCHAR,
  "first_name" VARCHAR,
  "last_name" VARCHAR,
  "display_name" VARCHAR,
  "profile_image_url" VARCHAR,
  "phone_number" VARCHAR,
  "preferred_email" VARCHAR,
  "role" VARCHAR NOT NULL DEFAULT 'volunteer'::character varying,
  "permissions" JSONB DEFAULT '[]'::jsonb,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "is_active" BOOL NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now(),
  "permissions_modified_at" TIMESTAMP,
  "permissions_modified_by" VARCHAR,
  "password_backup_20241023" TEXT,
  "last_active_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "volunteers" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('volunteers_id_seq'::regclass),
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "is_active" BOOL NOT NULL DEFAULT true,
  "vehicle_type" TEXT,
  "license_number" TEXT,
  "availability" TEXT DEFAULT 'available'::text,
  "zone" TEXT,
  "route_description" TEXT,
  "host_location" TEXT,
  "host_id" INT4,
  "van_approved" BOOL NOT NULL DEFAULT false,
  "home_address" TEXT,
  "availability_notes" TEXT,
  "email_agreement_sent" BOOL NOT NULL DEFAULT false,
  "voicemail_left" BOOL NOT NULL DEFAULT false,
  "inactive_reason" TEXT,
  "volunteer_type" TEXT NOT NULL DEFAULT 'general'::text,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "is_driver" BOOL NOT NULL DEFAULT false,
  "latitude" NUMERIC,
  "longitude" NUMERIC,
  "geocoded_at" TIMESTAMP,
  "is_speaker" BOOL NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "weekly_reports" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('weekly_reports_id_seq'::regclass),
  "week_ending" TEXT NOT NULL,
  "sandwich_count" INT4 NOT NULL,
  "notes" TEXT,
  "submitted_by" TEXT NOT NULL,
  "submitted_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "wishlist_suggestions" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('wishlist_suggestions_id_seq'::regclass),
  "item" TEXT NOT NULL,
  "reason" TEXT,
  "priority" VARCHAR NOT NULL DEFAULT 'medium'::character varying,
  "suggested_by" VARCHAR NOT NULL,
  "status" VARCHAR NOT NULL DEFAULT 'pending'::character varying,
  "admin_notes" TEXT,
  "amazon_url" TEXT,
  "estimated_cost" NUMERIC(10,2),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "reviewed_at" TIMESTAMP,
  "reviewed_by" VARCHAR
);

CREATE TABLE IF NOT EXISTS "work_logs" (
  "id" INT4 PRIMARY KEY DEFAULT nextval('work_logs_id_seq'::regclass),
  "user_id" VARCHAR NOT NULL,
  "description" TEXT NOT NULL,
  "hours" INT4 NOT NULL DEFAULT 0,
  "minutes" INT4 NOT NULL DEFAULT 0,
  "work_date" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "status" VARCHAR(20) DEFAULT 'pending'::character varying,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMPTZ,
  "visibility" VARCHAR(20) DEFAULT 'private'::character varying,
  "shared_with" JSONB DEFAULT '[]'::jsonb,
  "department" VARCHAR(50),
  "team_id" VARCHAR
);

