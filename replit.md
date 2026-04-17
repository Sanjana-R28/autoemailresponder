# AI Email Autoresponder

## Overview

An intelligent email autoresponder web application that uses AI to analyze incoming emails and automatically generate professional replies. Integrates with Gmail via OAuth2.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini)
- **Gmail**: googleapis OAuth2 + Gmail API
- **Frontend**: React + Vite + Tailwind CSS + Recharts

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Core Features

### Email Analysis (Multi-Agent AI)
- **Analyst Agent**: Classifies sentiment (Positive/Negative/Neutral), intent (Support Request/Feedback/Sales Inquiry/etc.), area (Product/Billing/Technical/etc.)
- **Responder Agent**: Generates professional email replies
- **Resumer Agent**: Outputs structured JSON results

### Gmail Integration
- OAuth2 authentication via Google Console credentials
- Read unread emails from inbox
- Auto-send AI-generated replies
- Revoke/disconnect access

### Modes
- **Manual Mode**: Paste any email to test the AI responder
- **Gmail Auto-Pilot**: Auto-respond to latest unread Gmail

## Environment Variables

- `GMAIL_CLIENT_ID` — Google OAuth Client ID (secret)
- `GMAIL_CLIENT_SECRET` — Google OAuth Client Secret (secret)
- `GMAIL_REDIRECT_URI` — optional OAuth callback URL override; the API normally derives the current callback URL from the request host
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI Integrations proxy URL
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI Integrations key
- `DATABASE_URL` — PostgreSQL connection string

## Database Schema

- `email_analysis` — stores all processed emails with AI classification
- `gmail_tokens` — stores Gmail OAuth tokens

## API Routes

- `POST /api/email/process` — analyze email and generate reply
- `GET /api/email/history` — list processed emails
- `GET /api/email/stats` — sentiment/intent/area stats
- `GET /api/gmail/auth-url` — get OAuth URL
- `GET /api/gmail/status` — connection status
- `GET /api/gmail/callback` — OAuth callback handler
- `POST /api/gmail/autorespond` — auto-reply to latest unread Gmail
- `POST /api/gmail/revoke` — disconnect Gmail

## Gmail Setup

To enable Gmail OAuth:
1. Go to https://console.cloud.google.com/
2. Create a project and enable Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI shown by the app host: `https://<your-domain>/api/gmail/callback`
5. Set `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` as secrets
6. If the Google OAuth consent screen is in testing mode, add the Gmail account being connected as a test user
