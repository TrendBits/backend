CREATE TABLE "guest_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text NOT NULL,
	"request_count" integer DEFAULT 1,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trend_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"search_term" text NOT NULL,
	"headline" text NOT NULL,
	"summary" text NOT NULL,
	"key_points" text NOT NULL,
	"call_to_action" text NOT NULL,
	"article_references" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hot_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"icon" varchar(20) NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" varchar(200) NOT NULL,
	"query" text NOT NULL,
	"batch_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" varchar(50),
	"email" varchar(100) NOT NULL,
	"password" varchar(255) NOT NULL,
	"reset_token" text,
	"reset_token_expires" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "trend_history" ADD CONSTRAINT "trend_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_guest_requests_ip" ON "guest_requests" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "idx_trend_history_user_id" ON "trend_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_trend_history_created_at" ON "trend_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_trend_history_user_created" ON "trend_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_trend_history_search_term" ON "trend_history" USING btree ("search_term");--> statement-breakpoint
CREATE INDEX "idx_hot_topics_batch_id" ON "hot_topics" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_hot_topics_created_at" ON "hot_topics" USING btree ("created_at");