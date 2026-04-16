import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const gmailTokensTable = pgTable("gmail_tokens", {
  id: serial("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiryDate: text("expiry_date"),
  email: text("email"),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GmailToken = typeof gmailTokensTable.$inferSelect;
