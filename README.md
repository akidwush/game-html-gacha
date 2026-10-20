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
Maximum **5 successful gacha rolls in a rolling 24-hour window per IP/browser**. Missed claw drops do not consume a chance. Each roll expires independently 24 hours after it succeeds, so chances return gradually instead of staying permanently blocked. Changing browsers on the same IP does not reset the server's IP counter. The UI reads `/api/gacha/status`, including `resetAt`, and the server returns HTTP 429 when blocked.

Raw IP addresses are not stored by the game code. An HMAC hash plus a signed browser device cookie is used for the casual limit.

## Routes
- `/game.html` — game
- `/admin.html` — reward admin
- `/api/gacha/status` — remaining chances for the current IP/browser
- `/api/gacha/roll` — reward roll after a successful catch

## Build
`game.html` at the repository root is the source UI. `npm run build` generates `public/game.html` and injects the CHANCES UI, current odds, refresh-safe limit handling, and browser-side anime-provider pool without rewriting the claw physics.

## Simple admin login (public demo only)
Open `/admin.html` and press LOGIN. For this deliberately simplified demo, the form is prefilled with:
- Email: `admin@gacha.local`
- Password: `GachaClaw2026!`

Admin credentials are also checked in `netlify/lib/auth.mjs`. **They are visible in browser source code and provide no meaningful protection**. Every visitor can discover these credentials and access the reward list, including account passwords. **Do not add real or valuable account rewards while using this mode**. For production, restore proper server-side authentication.

No Netlify admin environment variables are needed for demo login. `IP_HASH_SECRET` is optional for the IP/browser limiter; absent it, the code uses a fixed demo fallback for stable identifiers.

## Deploy and build
Netlify still needs its Functions and Blobs for server-side IP checks and shared jackpot reward records; this project is *not* a purely static HTML app. Deploy with the provided `netlify.toml` so `npm run build` runs. A pure HTML hosting service can show the game UI but cannot enforce IP-wide limits or share admin reward claims.
