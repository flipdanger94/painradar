import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL before applying migrations");
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE EXTENSION IF NOT EXISTS vector`;
await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
console.log("Migrations applied");
