# 🎰 Slot Party

A colorful web slot machine for a group of friends. Pick your name (no password),
choose one of six themed machines, and chase your own four progressive jackpots.
Every spin, win and jackpot is tracked on the server, with stats, achievements,
a leaderboard, a Hall of Fame and a live feed of everyone's big wins.

**Play money only. Credits have no cash value.**

## Features

- **6 themes:** Beach Paradise, Campaign Trail, Semper Fi, Royal Court, High Stakes, Walk of Fame
- **5×3 reels, 20 paylines**, wilds, bonus scatters, and free spins at 2×
- **Per-player progressive jackpots** (Mini / Minor / Major / GRAND) with a Jackpot Wheel bonus
- **Tiered celebrations:** Big → Mega → Epic → Jackpot, each with a theme-specific effect,
  coin showers, fireworks, confetti and synthesized sound
- **Stats:** balance chart, totals, biggest win, streaks, jackpots won, 12 achievements
- Leaderboards, Hall of Fame, live win feed and toasts, a 5,000-credit daily bonus
- Autoplay, turbo mode, a paytable, mute, reduce-motion, and a phone-friendly layout

## Running locally

```bash
npm install
npm run dev        # API on :3000, Vite dev server on http://localhost:5173
```

Production-style:

```bash
npm run build && npm start   # serves everything on http://localhost:3000
```

Other scripts:

| Command | What it does |
|---|---|
| `npm test` | Unit tests for payline evaluation, jackpots and win tiers |
| `npm run typecheck` | TypeScript check across client, server and shared code |
| `npm run simulate -- 4000000` | Monte Carlo check of the payout math (RTP, hit rate, feature odds) |

### Testing celebrations

Start the server with `SLOT_DEBUG=1` and open the game with `?force=big`, `mega`, `epic`,
`freespins`, `mini`, `minor`, `major` or `grand` to force that outcome. **Never set
`SLOT_DEBUG` in production.**

## Deploying to Railway

1. Create a Railway project from this GitHub repo. `railway.json` sets the build/start
   commands and health check.
2. Add a **volume** to the service (mount path e.g. `/data`). The server automatically
   stores `slots.db` in `RAILWAY_VOLUME_MOUNT_PATH`, so players and stats survive redeploys.
3. Generate a public domain and share the URL with friends.

Environment variables (all optional): `PORT`, `DATABASE_PATH`, `LOG_LEVEL`.

## How it's built

- `shared/` — game math (reels, paytable, paylines, jackpots), theme definitions, API types
- `server/` — Fastify + SQLite (better-sqlite3). All spins are decided on the server with a
  crypto RNG, so balances and leaderboards can't be faked from the browser.
- `client/` — React + Vite. The reels are a custom requestAnimationFrame engine
  (`client/src/engine/reels.ts`); celebrations use a canvas particle system
  (`particles.ts`); all sound is synthesized with Web Audio (`sound.ts`).
- `tools/simulate.ts` — RTP simulator used to tune the math (~95% total return).
