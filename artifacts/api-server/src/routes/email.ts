import { Router } from "express";
import { db } from "@workspace/db";
import { emailAnalysisTable } from "@workspace/db";
import { ProcessEmailBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { desc, count, sql } from "drizzle-orm";

const router = Router();

async function analyzeEmail(subject: string, body: string): Promise<{
  sentiment: string;
  intent: string;
  area: string;
  generatedReply: string;
}> {
  const systemPrompt = `You are a multi-agent email analysis system with three specialized agents:

1. ANALYST AGENT: Classify the email by:
   - Sentiment: exactly one of "Positive", "Negative", or "Neutral"
   - Intent: exactly one of "Support Request", "Feedback", "Sales Inquiry", "General Inquiry", "Complaint", or "Other"
   - Area: exactly one of "Product", "Billing", "Technical", "Sales", "General", or "Other"

2. RESPONDER AGENT: Generate a concise, professional email reply (2-4 paragraphs) that:
   - Addresses the sender's concern directly
   - Maintains a helpful and professional tone
   - Is appropriately matched to the sentiment and intent

3. RESUMER AGENT: Output the result as a structured JSON object.

You MUST respond with ONLY valid JSON in this exact format, no other text:
{
  "sentiment": "Positive" | "Negative" | "Neutral",
  "intent": "Support Request" | "Feedback" | "Sales Inquiry" | "General Inquiry" | "Complaint" | "Other",
  "area": "Product" | "Billing" | "Technical" | "Sales" | "General" | "Other",
  "generatedReply": "The full email reply text here"
}`;

  const userPrompt = `Analyze this email and generate a professional reply:

Subject: ${subject}

Body:
${body}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
  });

  const responseText = completion.choices[0]?.message?.content ?? "{}";

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    sentiment: parsed.sentiment ?? "Neutral",
    intent: parsed.intent ?? "General Inquiry",
    area: parsed.area ?? "General",
    generatedReply: parsed.generatedReply ?? "Thank you for your email. We will get back to you shortly.",
  };
}

router.post("/api/email/process", async (req, res) => {
  const parseResult = ProcessEmailBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { subject, body, senderName, senderEmail } = parseResult.data;

  const analysis = await analyzeEmail(subject, body);

  const [inserted] = await db.insert(emailAnalysisTable).values({
    subject,
    body,
    senderName: senderName ?? null,
    senderEmail: senderEmail ?? null,
    sentiment: analysis.sentiment,
    intent: analysis.intent,
    area: analysis.area,
    generatedReply: analysis.generatedReply,
    source: "manual",
    replySent: false,
  }).returning();

  res.json(inserted);
});

router.get("/api/email/history", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const [emails, totalResult] = await Promise.all([
    db.select().from(emailAnalysisTable)
      .orderBy(desc(emailAnalysisTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(emailAnalysisTable),
  ]);

  res.json({
    emails,
    total: totalResult[0]?.count ?? 0,
  });
});

router.get("/api/email/stats", async (req, res) => {
  const [totalResult, allEmails] = await Promise.all([
    db.select({ count: count() }).from(emailAnalysisTable),
    db.select({
      sentiment: emailAnalysisTable.sentiment,
      intent: emailAnalysisTable.intent,
      area: emailAnalysisTable.area,
      createdAt: emailAnalysisTable.createdAt,
    }).from(emailAnalysisTable).orderBy(desc(emailAnalysisTable.createdAt)),
  ]);

  const total = totalResult[0]?.count ?? 0;

  const sentimentBreakdown = { Positive: 0, Negative: 0, Neutral: 0 };
  const intentBreakdown: Record<string, number> = {};
  const areaBreakdown: Record<string, number> = {};
  const activityByDate: Record<string, number> = {};

  for (const email of allEmails) {
    if (email.sentiment in sentimentBreakdown) {
      sentimentBreakdown[email.sentiment as keyof typeof sentimentBreakdown]++;
    }
    intentBreakdown[email.intent] = (intentBreakdown[email.intent] ?? 0) + 1;
    areaBreakdown[email.area] = (areaBreakdown[email.area] ?? 0) + 1;

    const date = email.createdAt.toISOString().split("T")[0];
    activityByDate[date] = (activityByDate[date] ?? 0) + 1;
  }

  const recentActivity = Object.entries(activityByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({ date, count }));

  res.json({
    total,
    sentimentBreakdown,
    intentBreakdown,
    areaBreakdown,
    recentActivity,
  });
});

export { analyzeEmail };
export default router;
