import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailAnalysisTable = pgTable("email_analysis", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  sentiment: text("sentiment").notNull(),
  intent: text("intent").notNull(),
  area: text("area").notNull(),
  generatedReply: text("generated_reply").notNull(),
  source: text("source").default("manual"),
  gmailMessageId: text("gmail_message_id"),
  replySent: boolean("reply_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmailAnalysisSchema = createInsertSchema(emailAnalysisTable).omit({ id: true, createdAt: true });
export type InsertEmailAnalysis = z.infer<typeof insertEmailAnalysisSchema>;
export type EmailAnalysis = typeof emailAnalysisTable.$inferSelect;
