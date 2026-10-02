ALTER TABLE "conversation" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_kind_check" CHECK ("conversation"."kind" in ('access', 'data', 'integration', 'question', 'bug', 'feature'));