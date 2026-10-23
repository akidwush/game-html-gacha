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

## JSON image pool (random image tier, 40%)

The public-facing game fetches `/image-pool.json` only after a successful catch hits the server-selected `random` reward tier. The tier's odds remain **40%**; this does not modify jackpot probability, reward claims, or the 5-roll/24-hour limit.

- `public/image-pool.json` currently contains **2,753 unique HTTPS image URLs** from **27 public-oriented categories**, plus an empty `meme` category ready for additions.
- The catalog is expanded from the uploaded ZIP. Explicit sexual categories, categories with potential child-sexualization, videos, suspicious hosts, and malformed `random.json` were excluded.
- The schema is JSON v2: `{ "version": 2, "categories": { "cat": ["https://i.pinimg.com/...jpg"], "meme": [] } }`. A previous v1 catalog using relative Pinterest paths is also understood by the loader.
- To add memes, edit `public/image-pool.json` and append full HTTPS image URLs into `categories.meme`. All URLs must be from `i.pinimg.com`, `i.redd.it`, or `i.imgur.com` and end in a supported image extension: JPG, PNG, GIF, or WEBP.
- The browser checks up to four shuffled candidates, caches the index for the page session and avoids recently shown images using session storage. If every candidate fails to load, it falls back to the existing public meme API and then the inline fallback SVG.
- Adding new *category names* requires updating `IMAGE_POOL_CATEGORIES` in `game.html`; adding images to existing categories (including `meme`) requires **no code changes**.
- Third-party image availability, user rights and appropriateness cannot be established from URL lists alone. Manually review images and obtain rights before publicly displaying or monetizing them.

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
