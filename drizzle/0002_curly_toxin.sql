CREATE TABLE "ai_budgets" (
	"day" date PRIMARY KEY NOT NULL,
	"spent_micros" bigint DEFAULT 0 NOT NULL
);
