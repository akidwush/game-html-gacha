# Gacha Claw — Netlify

Mobile-first claw gacha game with Netlify Functions + Blobs.

## Drop rates
- 40% zonk
- 40% meme/random image
- 15% anime image
- 5% admin-managed account reward

## Casual per-IP limit
Maximum **5 successful gacha rolls per IP**. Missed claw drops do not consume a chance. The UI reads `/api/gacha/status`; the server remains the source of truth and returns HTTP 429 after the limit is exhausted.

Raw IP addresses are not stored by the game code. An HMAC hash is used as the Netlify Blobs storage prefix.

## Routes
- `/game.html` — game
- `/admin.html` — reward admin
- `/api/gacha/status` — remaining chances for the current IP
- `/api/gacha/roll` — reward roll after a successful catch

## Build
`game.html` at the repository root is the source UI. `npm run build` copies it into `public/game.html` and injects the lightweight CHANCES UI/limit handling without rewriting the claw physics.

## Required Netlify environment variables
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_SALT`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `IP_HASH_SECRET`

Secrets must stay in Netlify environment variables and must not be committed.

> Deployment note: admin runtime variables were configured in Netlify on 2026-10-18; this commit triggers a fresh production build.
