ALTER TABLE "ticket" DROP CONSTRAINT "ticket_status_check";--> statement-breakpoint
ALTER TABLE "ticket" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ticket" ADD COLUMN "close_reason" text;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_close_reason_check" CHECK ("ticket"."close_reason" in ('client_resolved', 'client_closed', 'staff'));--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_status_check" CHECK ("ticket"."status" in ('open', 'in_progress', 'waiting_client', 'resolved', 'closed', 'cancelled'));