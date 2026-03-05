### Overview
This full-stack application for The Sandwich Project nonprofit streamlines sandwich collections, donations, and distributions. It provides comprehensive data management, analytics, and operational tools for volunteers, hosts, and recipients. The project enhances data visibility, supports organizational growth, and is a vital tool for food security initiatives, aiming to reduce food waste and hunger with an annual goal of 500,000 sandwiches.

### User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Button labels and interface text must be extremely clear about their function - avoid ambiguous labels like "Submit" in favor of specific action descriptions like "Enter New Data".
Form Design: Eliminate redundant or confusing form fields - host dialogs should have a single "Host Location Name" field instead of separate "Name" and "Host Location" fields.
Mobile UX Priority: Mobile user experience is critical - chat positioning and space efficiency are key concerns. Vehicle type should NOT be required for new driver entries.
Documentation: All technical findings and fixes must be documented in replit.md to avoid repeated searching and debugging.
Analytics Philosophy: NEVER compare or rank hosts against each other. The Sandwich Project is about increasing volunteer turnout globally, not about which host reported more/less sandwiches. All host comparison features, "top performing hosts", "underperforming hosts", and similar language must be removed from analytics.
Desktop Chat UX: Desktop users require proper scrolling behavior without nested scrolling containers that cause page focus issues - chat layout must handle desktop and mobile differently.
Mobile Header Overflow: Dashboard header uses progressive hiding at breakpoints - user info hidden below xs (480px), comments button hidden below xs, OnlineUsers hidden below sm (640px). Button padding reduced on mobile (p-1.5 vs p-2). Header has overflow-x-hidden and max-w-full to prevent any overflow.

### System Architecture
The application features a React 18 frontend with TypeScript, Vite, TanStack Query, and Tailwind CSS (with shadcn/ui). The backend uses Express.js (TypeScript), Drizzle ORM, and PostgreSQL (Neon serverless), including session-based authentication. The UI/UX adheres to The Sandwich Project's official color palette and Roboto typography, prioritizing clarity, responsiveness, and card-based dashboards.

**UI/UX Decisions:**
- Modern, compact design with white card backgrounds, colored left borders for status, warm paper tone page background, subtle shadows, and a strong tonal hierarchy.
- Operational monitoring uses Wednesday-Tuesday week boundaries.
- Visualizations include two-line charts for collection trends and summary cards.
- Purple markers for recipients on maps (distinct from blue events, green hosts).
- "Nearby Recipients" section in right panel showing recipients within 15 miles of selected event.

**Technical Implementations:**
- **Authentication & Permissions**: Role-based access control, session management, password security, and active user enforcement with environment variables controlling modes.
- **Database Configuration**: Centralized database URL selection, specific migration rules for Neon serverless, and careful handling of Drizzle ORM returning clauses.
- **Data Management**: Comprehensive management of collections, hosts, recipients, users, and audit logs with Zod validation, timezone-safe date handling, and soft deletes. `sandwich_collections` is the operational source of truth.
- **Sandwich Totals Calculation**: Correctly sums either `jsonb group_collections` or legacy `group1_count`/`group2_count` fields to prevent double-counting.
- **Messaging & Notifications**: Email (SendGrid), Socket.IO chat, SMS (Twilio), and dashboard notifications. All outgoing emails BCC'd to `katie@thesandwichproject.org`.
- **Operational Tools**: Project, meeting, and work log management, user feedback, analytics dashboards, and a permissions-based Collection Walkthrough Tool. Event impact reports count actual `sandwichCollections`.
- **Event Requests Management System**: Tracks requests, handles duplicates, manages statuses, integrates with Google Sheets, calculates van driver staffing, supports multi-recipient assignment, intake validation, and interactive Leaflet maps with AI Assistants. Includes auto-save and specific handling for corporate priority and standby follow-ups, along with optimistic lock bypass for contact logs.
- **Real-Time Collaboration System**: Multi-user collaboration using Socket.IO for synchronization, presence tracking, field-level locking, threaded comments, and edit revision history.
- **Real-Time Online Presence Notifications**: WebSocket-based instant online presence notifications via Socket.IO with client-side toast notifications.
- **User Activity Logging System**: Comprehensive tracking of authenticated user actions.
- **Sandwich Type Tracking System**: Comprehensive tracking for individual and group collections with real-time validation and analytics.
- **Interactive Route Map & Driver Optimization**: Leaflet map for visualizing host contact locations, route optimization, and driver assignment.
- **Automated Reminders**: 24-hour volunteer reminder system via cron job with configurable email/SMS delivery.
- **TSP Contact Follow-up Notifications**: Automated daily reminders for TSP contacts for approaching 'in_progress' events and toolkit follow-ups.
- **Tiered Notification System**: Three-tier architecture (URGENT, IMPORTANT, DIGEST) to prevent alert fatigue.
- **Corporate 24h Escalation Rate Limiting**: Corporate escalation SMS is rate-limited to once per 24 hours per event, for 'new' or 'in_process' statuses.
- **Notification Status Filtering**: All notification queries exclude inactive event statuses and only include active ones.
- **Smart Follow-up SMS Batching**: SMS notifications are batched per user; emails remain individual.
- **Stale Event Escalation Email Batching**: Escalation emails for stale events are batched into one weekly summary email for specific administrators.
- **SMS Alert Configuration System**: Users can opt-in to SMS notifications, with support for 'hosts' (weekly collection reminders) and 'events' (event coordination) campaign types.
- **Kudos Mark-as-Read System**: Tracks Kudos messages and allows marking them as read via the messaging service.
- **TSP Holding Zone**: Inbox-style system for long-term ideas/tasks with categories, urgent flagging, commenting, likes, assignments, and a three-tier permission system.
- **Guided Tours & Onboarding System**: Interactive, permission-based step-by-step tours for new users.
- **Error Handling & Logging**: Robust error handling with `lazyWithRetry` and improved production-safe logging.
- **Timezone Management**: Ensures accurate storage and display of user-entered times, adhering to `America/New_York`.
- **Google Sheets Sync**: Background service with comprehensive monitoring, alerts, triple deduplication, and message backfill.
- **React Query Cache Management**: Uses `queryClient.refetchQueries` for immediate UI updates on mutation success.
- **Organization Merge System**: Admin tool to merge duplicate organizations, including similarity scoring, merge preview, and batch updates.
- **Email Template Customization System**: Admins can customize key sections of HTML emails via a UI, supporting placeholders.
- **External API Key Authentication**: Supports API key authentication for external app integrations with role-based permissions and SHA-256 hashed keys.
- **Intake Workflow App Integration**: External app pulls assigned event requests, allows coordinators to complete intake forms, and pushes data back to update events to 'scheduled' status.
- **Document Storage (Cloud)**: Documents stored in Replit Object Storage (Google Cloud Storage) using a two-step presigned URL flow for uploads and cloud streaming for downloads, with fallback for legacy local files.

### External Dependencies
- **Database**: `@neondatabase/serverless`, `drizzle-orm`
- **Web Framework**: `express`
- **UI/Styling**: `@radix-ui`, `tailwindcss`, `lucide-react`, `class-variance-authority`, `shadcn/ui`
- **Data Fetching/State**: `@tanstack/react-query`, `react-hook-form`, `zod`
- **Email**: `@sendgrid/mail`
- **Real-time Communication**: `socket.io`, `socket.io-client`
- **PDF Generation**: `pdfkit`
- **Authentication**: `connect-pg-simple`
- **File Uploads**: `multer`, `@uppy/core`, `@uppy/aws-s3`, `@uppy/dashboard`, `@uppy/react`
- **Cloud Storage**: `@google-cloud/storage`
- **Google Integration**: Google Sheets API, Google Analytics
- **Mapping**: `leaflet`, `react-leaflet`, `react-leaflet-cluster`
- **SMS**: `twilio`