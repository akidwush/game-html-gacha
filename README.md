# Gacha Claw — Netlify

Mobile-first claw gacha game with Netlify Functions + Blobs.

## Drop rates
- 44.9% zonk
- 40% meme/random image
- 15% anime image
- 0.1% admin-managed account reward (ultra jackpot)

The account reward uses an exact 10/10,000 server-side bucket (`crypto.randomInt`) so the jackpot probability is 0.1%.

## Anime image providers
The 15% anime tier is selected server-side, but image fetching/failover happens in the visitor's browser. Current provider pool:
- Nekosia (suggestive, with `young-girl` + `schoolgirl` blacklist)
- Nekos.best (SFW)
- Waifu.pics (SFW)
- Nekos API v4 (SFW)
- Nekos.moe (SFW)
- Nekos.life (SFW)

The browser shuffles providers, avoids using the last successful provider first, remembers up to 64 recent image URLs, and automatically fails over when a provider is unavailable/CORS-blocked/rate-limited.

## Casual per-IP/browser limit
Maximum **5 successful gacha rolls per IP/browser**. Missed claw drops do not consume a chance. The UI reads `/api/gacha/status`; the server remains the source of truth and returns HTTP 429 after the limit is exhausted.

Raw IP addresses are not stored by the game code. An HMAC hash plus a signed browser device cookie is used for the casual limit.

## Routes
- `/game.html` — game
- `/admin.html` — reward admin
- `/api/gacha/status` — remaining chances for the current IP/browser
- `/api/gacha/roll` — reward roll after a successful catch

## Build
`game.html` at the repository root is the source UI. `npm run build` generates `public/game.html` and injects the CHANCES UI, current odds, refresh-safe limit handling, and browser-side anime-provider pool without rewriting the claw physics.

## Required Netlify environment variables
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_SALT`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `IP_HASH_SECRET`

Secrets must stay in Netlify environment variables and must not be committed.
