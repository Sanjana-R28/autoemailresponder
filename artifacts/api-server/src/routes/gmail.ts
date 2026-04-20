import { Router, type Request } from "express";
import { google } from "googleapis";
import { db } from "@workspace/db";
import { gmailTokensTable, emailAnalysisTable } from "@workspace/db";
import { analyzeEmail } from "./email.js";
import { sql } from "drizzle-orm";

const router = Router();

function getEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return null;
}

function getRequestOrigin(req: Request) {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol || "https";
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.get("host");

  return host ? `${proto}://${host}` : null;
}

function getRedirectUri(req?: Request) {
  const replitDomain = getEnvValue("REPLIT_DOMAINS", "REPLIT_DEV_DOMAIN")?.split(",")[0]?.trim();
  if (replitDomain) return `https://${replitDomain}/api/gmail/callback`;

  const configuredRedirectUri = getEnvValue("GMAIL_REDIRECT_URI", "GOOGLE_REDIRECT_URI");
  if (configuredRedirectUri) return configuredRedirectUri;

  const origin = req ? getRequestOrigin(req) : null;
  if (origin) return `${origin}/api/gmail/callback`;

  return null;
}

function getOAuthConfig(req?: Request) {
  const clientId = getEnvValue("GMAIL_CLIENT_ID", "GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getEnvValue("GMAIL_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET");
  const redirectUri = getRedirectUri(req);

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

function getOAuth2Client(req?: Request) {
  const config = getOAuthConfig(req);
  if (!config) {
    throw new Error("Gmail OAuth credentials are not configured. Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET as secrets.");
  }

  const { clientId, clientSecret, redirectUri } = config;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getGoogleErrorStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error) {
    return Number((error as { status?: unknown }).status);
  }

  return null;
}

function isGoogleAuthError(error: unknown) {
  const status = getGoogleErrorStatus(error);
  if (status === 401 || status === 403) return true;

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return code === 401 || code === 403 || code === "401" || code === "403";
  }

  if (typeof error === "object" && error !== null && "response" in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof data === "object" && data !== null && "error" in data) {
      const googleError = (data as { error?: unknown }).error;
      return googleError === "invalid_grant" || googleError === "invalid_token";
    }
  }

  return false;
}

async function refreshStoredGmailCredentials(oauth2Client: ReturnType<typeof getOAuth2Client>, refreshToken: string | null) {
  if (!refreshToken) {
    return false;
  }

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  const accessToken = credentials.access_token;

  if (!accessToken) {
    return false;
  }

  oauth2Client.setCredentials({
    ...credentials,
    refresh_token: credentials.refresh_token ?? refreshToken,
  });

  await db.update(gmailTokensTable).set({
    accessToken,
    refreshToken: credentials.refresh_token ?? refreshToken,
    expiryDate: credentials.expiry_date?.toString() ?? null,
    updatedAt: new Date(),
  });

  return true;
}

router.get("/gmail/auth-url", async (req, res) => {
  if (!getOAuthConfig(req)) {
    res.json({
      url: "",
      configured: false,
      message: "Gmail is not configured. Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET as secrets, then restart the API server.",
    });
    return;
  }

  const oauth2Client = getOAuth2Client(req);
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
  });

  res.json({ url });
});

router.get("/gmail/callback", async (req, res) => {
  const oauthError = req.query.error as string | undefined;
  if (oauthError) {
    const description = (req.query.error_description as string | undefined) ?? "Google denied access to this Gmail account.";
    res.status(400).send(`<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; padding: 2rem;"><h1>Gmail connection was denied</h1><p>${description}</p><p>If this Google app is in testing mode, make sure this Gmail address is added as a test user in Google Cloud, then try connecting again.</p></body></html>`);
    return;
  }

  const code = req.query.code as string;
  if (!code) {
    res.status(400).send("No authorization code provided");
    return;
  }

  const oauth2Client = getOAuth2Client(req);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  await db.delete(gmailTokensTable);
  await db.insert(gmailTokensTable).values({
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token ?? null,
    expiryDate: tokens.expiry_date?.toString() ?? null,
    email: userInfo.data.email ?? null,
    name: userInfo.data.name ?? null,
  });

  const origin = getRequestOrigin(req);
  if (origin) {
    res.redirect(`${origin}/?gmail=connected`);
  } else {
    res.send(`<html><body><p>Gmail connected successfully! You can close this tab and return to the app.</p></body></html>`);
  }
});

router.get("/gmail/status", async (req, res) => {
  const tokens = await db.select().from(gmailTokensTable).limit(1);
  if (tokens.length === 0) {
    res.json({ connected: false, email: null, name: null });
    return;
  }

  res.json({
    connected: true,
    email: tokens[0].email,
    name: tokens[0].name,
  });
});

router.get("/gmail/diagnostics", async (req, res) => {
  const config = getOAuthConfig(req);
  const redirectUri = getRedirectUri(req);
  let databaseReady = false;
  let gmailConnected = false;
  let connectedEmail: string | null = null;
  let connectedName: string | null = null;
  let databaseError: string | null = null;

  try {
    await db.execute(sql`select to_regclass('public.gmail_tokens')`);
    const tokens = await db.select().from(gmailTokensTable).limit(1);
    databaseReady = true;
    gmailConnected = tokens.length > 0;
    connectedEmail = tokens[0]?.email ?? null;
    connectedName = tokens[0]?.name ?? null;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Database check failed";
  }

  const parsedRedirectUri = redirectUri ? new URL(redirectUri) : null;
  const redirectUriLooksPublic =
    Boolean(parsedRedirectUri) &&
    parsedRedirectUri!.protocol === "https:" &&
    !["localhost", "127.0.0.1", "0.0.0.0"].includes(parsedRedirectUri!.hostname);
  const redirectPathCorrect = parsedRedirectUri?.pathname === "/api/gmail/callback";
  const aiConfigured = Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  );

  const checks = [
    {
      id: "gmail-client-id",
      label: "Gmail Client ID",
      status: getEnvValue("GMAIL_CLIENT_ID", "GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID") ? "pass" : "fail",
      detail: getEnvValue("GMAIL_CLIENT_ID", "GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID")
        ? "Configured"
        : "Missing secret",
      action: "Add GMAIL_CLIENT_ID as a secret.",
    },
    {
      id: "gmail-client-secret",
      label: "Gmail Client Secret",
      status: getEnvValue("GMAIL_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET")
        ? "pass"
        : "fail",
      detail: getEnvValue("GMAIL_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET")
        ? "Configured"
        : "Missing secret",
      action: "Add GMAIL_CLIENT_SECRET as a secret.",
    },
    {
      id: "redirect-uri",
      label: "OAuth Redirect URL",
      status: redirectUriLooksPublic && redirectPathCorrect ? "pass" : "fail",
      detail: redirectUri ?? "No redirect URL available",
      action: "Add this exact redirect URL to Google Cloud OAuth credentials.",
    },
    {
      id: "database",
      label: "Database Tables",
      status: databaseReady ? "pass" : "fail",
      detail: databaseReady ? "Gmail token table is ready" : databaseError ?? "Database is not ready",
      action: "Run the database schema push before connecting Gmail.",
    },
    {
      id: "ai",
      label: "AI Reply Generator",
      status: aiConfigured ? "pass" : "fail",
      detail: aiConfigured ? "AI service is configured" : "AI service settings are missing",
      action: "Provision the AI service before auto-responding.",
    },
    {
      id: "gmail-connection",
      label: "Saved Gmail Connection",
      status: gmailConnected ? "pass" : "warn",
      detail: gmailConnected
        ? `Connected as ${connectedEmail ?? connectedName ?? "Gmail account"}`
        : "No Gmail account connected yet",
      action: "Use the Connect Gmail button to complete Google authorization.",
    },
  ];

  const readyToConnect = Boolean(config) && redirectUriLooksPublic && redirectPathCorrect && databaseReady;
  const readyToAutoRespond = readyToConnect && gmailConnected && aiConfigured;

  res.json({
    readyToConnect,
    readyToAutoRespond,
    redirectUri,
    googleCloudRequiredRedirectUri: redirectUri,
    requiredScopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    connectedAccount: gmailConnected
      ? {
          email: connectedEmail,
          name: connectedName,
        }
      : null,
    commonAccessDeniedFixes: [
      "Make sure this exact redirect URL is listed in Google Cloud OAuth Authorized redirect URIs.",
      "If the OAuth consent screen is in testing mode, add the Gmail address as a test user.",
      "Enable the Gmail API in the same Google Cloud project as the OAuth client.",
      "Use OAuth client type Web application, not Desktop or Android.",
    ],
    checks,
  });
});

router.post("/gmail/autorespond", async (req, res) => {
  const tokenRows = await db.select().from(gmailTokensTable).limit(1);
  if (tokenRows.length === 0) {
    res.status(400).json({ error: "Gmail not connected. Please authenticate first." });
    return;
  }

  const tokenRow = tokenRows[0];
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken ?? undefined,
    expiry_date: tokenRow.expiryDate ? parseInt(tokenRow.expiryDate) : undefined,
  });

  oauth2Client.on("tokens", async (newTokens) => {
    if (newTokens.access_token) {
      await db.update(gmailTokensTable).set({
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token ?? tokenRow.refreshToken,
        expiryDate: newTokens.expiry_date?.toString() ?? null,
        updatedAt: new Date(),
      });
    }
  });

  try {
    await refreshStoredGmailCredentials(oauth2Client, tokenRow.refreshToken);
  } catch (error) {
    if (isGoogleAuthError(error)) {
      await db.delete(gmailTokensTable);
      res.status(401).json({ error: "Gmail authorization expired. Please reconnect Gmail and try Auto-Pilot again." });
      return;
    }

    throw error;
  }

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  let listResponse;
  try {
    listResponse = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 1,
    });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      await db.delete(gmailTokensTable);
      res.status(401).json({ error: "Gmail authorization expired. Please reconnect Gmail and try Auto-Pilot again." });
      return;
    }

    throw error;
  }

  const messages = listResponse.data.messages;
  if (!messages || messages.length === 0) {
    res.json({ success: false, message: "No unread emails found in your inbox.", analysis: null });
    return;
  }

  const messageId = messages[0].id!;
  const messageResponse = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const message = messageResponse.data;
  const headers = message.payload?.headers ?? [];

  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const subject = getHeader("Subject") || "(No Subject)";
  const from = getHeader("From");
  const threadId = message.threadId!;

  const fromMatch = from.match(/^(.*?)\s*<(.+?)>$/) ?? [null, null, from];
  const senderName = fromMatch[1]?.trim() ?? from;
  const senderEmail = fromMatch[2]?.trim() ?? from;

  function decodeBody(payload: typeof message.payload): string {
    if (!payload) return "";
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        }
      }
      for (const part of payload.parts) {
        if (part.mimeType === "text/html" && part.body?.data) {
          const html = Buffer.from(part.body.data, "base64").toString("utf-8");
          return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
        }
      }
    }
    return "";
  }

  const emailBody = decodeBody(message.payload);

  const analysis = await analyzeEmail(subject, emailBody.slice(0, 3000));

  const replyBody = `From: me\r\nTo: ${senderEmail}\r\nSubject: Re: ${subject}\r\nIn-Reply-To: ${messageId}\r\nReferences: ${messageId}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${analysis.generatedReply}`;
  const encodedReply = Buffer.from(replyBody).toString("base64url");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedReply,
      threadId: threadId,
    },
  });

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });

  const [inserted] = await db.insert(emailAnalysisTable).values({
    subject,
    body: emailBody.slice(0, 5000),
    senderName: senderName || null,
    senderEmail: senderEmail || null,
    sentiment: analysis.sentiment,
    intent: analysis.intent,
    area: analysis.area,
    generatedReply: analysis.generatedReply,
    source: "gmail",
    gmailMessageId: messageId,
    replySent: true,
  }).returning();

  res.json({
    success: true,
    message: `Successfully replied to email from ${senderEmail}: "${subject}"`,
    analysis: inserted,
  });
});

router.post("/gmail/revoke", async (req, res) => {
  await db.delete(gmailTokensTable);
  res.json({ success: true, message: "Gmail access revoked successfully." });
});

export default router;
