# EVSU Voting System

Web-based voting platform built with Next.js and Supabase.

## Run Locally

1. Install dependencies:

```bash
pnpm install
```

2. Create your environment file:

```bash
cp .env.example .env.local
# PowerShell
Copy-Item .env.example .env.local
```

3. Fill in all required variables in `.env.local`.

4. Start development server:

```bash
pnpm dev
```

## Environment Variables

Required values are listed in `.env.example`.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESET_OTP_SECRET` (optional, recommended for signing reset OTP cookies)
- `NEXT_PUBLIC_APP_URL` (set this to your deployed HTTPS domain, not localhost, for production)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER` (must be a real sender email address, e.g. `votingevsu@gmail.com`)
- `SMTP_APP_PASSWORD`
- `SMTP_FROM` (can be `EVSU VOTING <votingevsu@gmail.com>`)

## Registration Confirmation Email Flow

1. User creates account on `/register`.
2. Supabase sends its verification email.
3. API route `POST /api/auth/register-confirmation` sends a separate registration confirmation/welcome email via SMTP.

## Deployment Notes (No Localhost Links)

1. Set `NEXT_PUBLIC_APP_URL` to your deployed domain (example: `https://evsu-voting.vercel.app`).
2. Add the same value in your hosting environment variables (Production and Preview).
3. In Supabase Auth URL settings, add your deployed domain to allowed redirect URLs.
4. Keep localhost URLs only for local development, not production env values.

## Password Reset Flow

1. User submits email on `/forgot-password`.
2. API route `POST /api/auth/forgot-password` generates a Supabase recovery link.
3. API sends the link via SMTP (Nodemailer).
4. User lands on `/auth/confirm`, then gets redirected to `/reset-password`.
5. System sends a 6-digit OTP to the recovery-session email.
6. User verifies OTP on `/reset-password`.
7. Only after OTP verification can user set a new password.

## Validation Notes

The email API routes validate:

- email format
- required Supabase server keys
- required SMTP credentials
- valid `SMTP_PORT` and `SMTP_SECURE` values
- production-safe app origin resolution (rejects localhost-only origin in production)
