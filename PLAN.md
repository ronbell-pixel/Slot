# Slot Machine Game — Build Plan

A colorful, modern, web-based slot machine for a small group of friends. Players
type their name (no password), pick a theme, spin, and chase big jackpots with
over-the-top celebrations. Every player's spins, wins and stats are tracked
on the server, and there's a shared leaderboard.

> **Play money only.** Credits are virtual and have no cash value. There's no
> real-money betting, purchases or payouts.

## Build status

| Phase | Status |
|---|---|
| 1. Foundation (repo, name login, player switching) | ✅ Done |
| 2. Core engine (server spins, paylines, reels, RTP simulator, tests) | ✅ Done |
| 3. First theme + celebrations + free spins | ✅ Done |
| 4. Per-player jackpots, Jackpot Wheel, live feed | ✅ Done |
| 5. Remaining themes | ✅ Done (all 6, with emoji art for now) |
| 6. Stats, leaderboards, Hall of Fame, achievements, daily bonus | ✅ Done |
| 7. Polish & launch | 🟡 Mobile layout, settings and Railway config done; deploy and custom art still to do |

**Changes from the original stack (and why):**
- **Reels:** a custom DOM/GPU-transform engine instead of PixiJS. Smooth at 60fps,
  much smaller, and the CSS glow/blur effects look great with emoji symbols.
- **Particles:** a small custom canvas system (coins, confetti, fireworks, emoji)
  instead of Pixi emitters + canvas-confetti.
- **Sound:** synthesized with the Web Audio API instead of Howler.js audio files,
  so there are no assets to source. Real music/SFX can be added later.
- **Styling:** plain CSS with theme variables instead of Tailwind.
- **Live updates:** Server-Sent Events instead of WebSockets (one-way is all we need).
- **Art:** themed emoji on styled tiles for now; swap in generated artwork later
  by changing `shared/themes.ts` and the symbol renderer.
- **Math:** bets are 20–1,000 (so a line bet is always a whole number), and RTP
  is ~95% (verified with `npm run simulate`).

---

## 1. Goals

| Goal | What it means in practice |
|---|---|
| Great modern graphics | GPU-rendered reels (WebGL), smooth 60fps animation, glow/blur/particle effects, responsive on phone and desktop |
| Several themes | 6 themes at launch, each with its own symbols, background, colors, music and sound effects |
| Large jackpots | 4-tier progressive jackpot (Mini / Minor / Major / **GRAND**), separate for each player and growing with every spin they make |
| Celebrations | Tiered win animations: Nice Win → Big Win → Mega Win → Epic Win → Jackpot (coin showers, fireworks, screen shake, count-up meters) |
| Easy access | One public URL, no install, works in any modern browser |
| No passwords | Enter a name to play; the browser remembers you |
| Per-user tracking | Server stores each player's balance, spin history, wins, jackpots and lifetime stats |

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **React + TypeScript + Vite** | Fast dev server, simple build, typed code |
| Reel rendering | **PixiJS v8** (WebGL) | Hardware-accelerated sprites, filters (glow, blur, bloom), particle systems |
| Animation | **GSAP** | Precise easing for reel spin/stop, count-ups, UI transitions |
| Celebrations | Pixi particle emitters + **canvas-confetti** | Coin showers, fireworks, confetti bursts |
| Sound | **Howler.js** | Reliable cross-browser audio, sprite sheets, mute/volume |
| UI styling | **Tailwind CSS** | Quick, consistent menus, stats pages and overlays |
| Backend | **Node.js + Fastify** | Small, fast API server |
| Database | **SQLite** (via `better-sqlite3`) | No separate DB server; ideal for a handful of players |
| Hosting | **Railway** (single service + persistent volume for the SQLite file) | One-click deploys from GitHub, free/cheap tier, HTTPS URL included |
| Testing | **Vitest** (unit), **Playwright** (end-to-end) | Covers both the game math and the browser flow |

The frontend is built into static files and served by the same Fastify server,
so the whole game is **one deployable service with one URL**.

---

## 3. Player Identity (no passwords)

1. First visit shows a **"What's your name?"** screen with a big colorful input
   and an avatar/color picker.
2. `POST /api/players` creates the player (or finds the existing one) and returns
   a random **player token**.
3. The token is saved in the browser's `localStorage`; future visits skip the
   name screen and go straight to the lobby.
4. A **"Switch player"** button lets friends share a device: it shows the list
   of existing players to pick from, or lets a new one be added.
5. Names are unique (case-insensitive) so stats aren't split across "Ron" and "ron".

Because it's just for friends, this is intentionally low-security: anyone can
pick any name from the switch-player list. That's the agreed trade-off for
"no password necessary" — no PINs.

---

## 4. Themes (launch set of 6)

Each theme is a self-contained **theme pack**: a config file plus art and audio.
Adding a theme later means adding a folder — no engine changes.

| Theme | Look & feel | Example symbols (low → high) | Signature win effect |
|---|---|---|---|
| **Beach Paradise** | Turquoise water, golden sand, sunset gradient, swaying palms | Seashells, flip-flops, beach ball, surfboard, cocktail, sun | Wave sweeps across the reels, splash particles |
| **Campaign Trail** (Politics) | Red/white/blue bunting, spotlights, confetti cannons | Ballot box, campaign button, gavel, podium, donkey & elephant, the Capitol | Balloon drop + confetti cannon, "LANDSLIDE!" banner |
| **Semper Fi** (Marines) | Camo greens, desert tan, dog-tag metal, stars & stripes | Dog tags, boots, helmet, compass, bulldog mascot, eagle | Jet flyover streak, salute-style banner, bugle fanfare |
| **Royal Court** (Kings) | Crimson velvet, gold filigree, castle backdrop | Goblet, shield, sword, scepter, crown, the King | Golden crown drops onto the win, trumpet fanfare |
| **High Stakes** (Cards) | Green felt, gold trim, casino lighting | 10, J, Q, K, A, chip stack, Royal Flush | Cards fan out and flip, chip avalanche |
| **Walk of Fame** (Famous People) | Hollywood red carpet, paparazzi flashes, marquee lights | Film reel, microphone, sunglasses, star plaque, golden statuette, caricature "stars" | Camera-flash storm, spotlights, red-carpet roll-out |

**Notes on a few themes:**
- **Politics** stays bipartisan and playful (both donkey and elephant, no
  real candidates) so it's fun for everyone in the group.
- **Famous People** uses **caricature archetypes** (the Rock Star, the Movie
  Star, the Diva, the Tycoon…) rather than real celebrities' faces or names —
  AI image tools generally won't produce real-person likenesses, and it avoids
  likeness-rights issues. If there are specific in-joke "stars" in the friend
  group, those can be added as cartoon versions.
- **Marines** uses generic Marine-inspired imagery (bulldog, eagle, dog tags,
  camo) rather than the official Eagle, Globe & Anchor emblem, which is a
  protected trademark.

Every theme shares the same special symbols, reskinned:
- **WILD** — substitutes for any regular symbol
- **SCATTER** — 3+ anywhere triggers **Free Spins**
- **JACKPOT** — 5 on a payline (or the Jackpot Wheel bonus) wins a progressive tier

**Art approach:** Generate the symbol art and backgrounds with an AI image tool
(consistent per-theme style prompts), then clean up and export as sprite sheets
(WebP, @1x and @2x). Glow, shine sweeps and particles are done in code so the art
stays lightweight.

---

## 5. Game Design & Math

### Layout
- **5 reels × 3 rows**, **20 fixed paylines**
- Bet levels: 10, 20, 50, 100, 250, 500 credits per spin
- Starting balance: **10,000 credits**; free **daily bonus** of 5,000 if balance
  runs low, so no one is ever locked out

### Features
- **Free Spins:** 3/4/5 scatters → 10/15/25 free spins with a 2× multiplier
- **Jackpot Wheel bonus:** rare trigger; spinning prize wheel lands on a jackpot tier
- **Turbo mode** and **Autoplay** (10/25/50/100 spins, stops on big wins)

### Progressive Jackpots (separate for each player)
| Tier | Seed value | Grows by | Approx. odds per spin |
|---|---|---|---|
| Mini | 1,000 | 0.5% of each bet | ~1 in 150 |
| Minor | 10,000 | 0.3% | ~1 in 1,500 |
| Major | 100,000 | 0.15% | ~1 in 15,000 |
| **GRAND** | **1,000,000** | 0.05% | ~1 in 150,000 |

Each player has **their own four jackpot pools**. They grow only from that
player's bets, are shown at the top of their screen, tick upward with every
spin, and reset to the seed value when won. Pools are per player across all
themes (one set of meters, not one per theme).

Even though pools are private, wins are social: when someone hits a jackpot,
**every connected friend sees a broadcast banner** ("🎉 Ron just won the
MAJOR jackpot: 143,250!") and it's added to the Hall of Fame.

### Target payout
- **~96% return-to-player**, with frequent small wins and rare huge ones
- A **simulation script** spins 10 million times and reports RTP, hit frequency,
  feature frequency and jackpot frequency. Reel strips and paytables are tuned
  until the numbers land on target.

### Fairness / anti-cheat
All spin results are decided **on the server** (crypto-secure RNG). The browser
only animates the result it receives, so nobody can edit their balance from the
browser console and the leaderboard stays honest.

---

## 6. Celebrations

Win size is measured as a multiple of the bet, and each tier escalates:

| Tier | Trigger | Effects |
|---|---|---|
| Nice Win | < 5× bet | Winning line draws, symbols pulse & glow, coin chime |
| **Big Win** | 5–15× | Banner slam-in, coin fountain, count-up meter, music sting |
| **Mega Win** | 15–50× | Bigger banner, screen shake, light rays, coin rain |
| **Epic Win** | 50×+ | Full-screen takeover, fireworks, theme-specific mega effect (fire breath, warp, etc.) |
| **JACKPOT** | Progressive hit | Lights-out → spotlight → giant tier badge, gold coin avalanche, fireworks + confetti, fanfare, server-wide broadcast, permanent entry in the Hall of Fame |

All celebrations are skippable with a tap, and respect a **"Reduce motion"**
setting (no shake/flashing) for accessibility.

---

## 7. Stats & Leaderboards

### Tracked per player
- Current balance, total spins, total wagered, total won
- Net profit/loss, personal return %, win rate
- Biggest single win (with theme and date)
- Jackpots won by tier
- Free-spin rounds triggered
- Favorite theme (most spins)
- Current and longest win streaks
- Recent spin history (last 100 spins with result, bet, win)

### Screens
- **Profile / My Stats** — stat cards, current jackpot pool values, and a balance-over-time line chart
- **Leaderboard** — tabs for Biggest Win, Most Won, Most Spins, Jackpots
- **Hall of Fame** — every jackpot ever hit: who, tier, amount, theme, when
- **Live feed** — sidebar ticker of friends' big wins as they happen

### Achievements (fun extra)
Badges like "First Spin", "Big Winner", "Jackpot Hunter", "Theme Explorer
(play all 6)", "High Roller", "Comeback Kid".

---

## 8. Architecture

```
Browser (React + PixiJS)
   │  REST: login, spin, stats, leaderboard
   │  WebSocket: win broadcasts, live feed
   ▼
Fastify server (Node.js)
   ├── /api/players      create/find player by name → token
   ├── /api/spin         validates bet & balance, runs RNG, returns result
   ├── /api/stats/:id    player stats & history
   ├── /api/leaderboard  ranked lists
   ├── /api/jackpots     the player's own jackpot values
   ├── /ws               live updates
   └── serves the built frontend (static files)
   ▼
SQLite database (on a persistent volume)
```

### Database tables
- `players` — id, name, token, avatar, color, balance, created_at, last_seen
- `spins` — id, player_id, theme, bet, win, result grid (JSON), feature, created_at
- `jackpots` — player_id, tier, current_value, seed_value, last_won_at
- `jackpot_wins` — id, player_id, tier, amount, theme, created_at
- `player_stats` — rolled-up totals per player (updated on each spin for fast reads)
- `achievements` — player_id, badge, earned_at

### Project structure
```
/
├── client/                 React + Pixi frontend
│   ├── src/engine/         reel renderer, animations, particles
│   ├── src/themes/         one folder per theme (config.ts, art, sounds)
│   ├── src/screens/        Login, Lobby, Game, Stats, Leaderboard, HallOfFame
│   └── src/components/
├── server/                 Fastify API
│   ├── src/game/           RNG, reels, paytable, payline evaluation, jackpots
│   ├── src/routes/
│   └── src/db/             schema + migrations
├── shared/                 types and game config shared by client & server
├── tools/simulate.ts       10M-spin RTP simulator
└── PLAN.md
```

---

## 9. Build Phases

### Phase 1 — Foundation
- Set up the repo: Vite/React client, Fastify server, shared types, SQLite schema
- Name-entry login with token, player switching
- Basic API: create player, get balance

### Phase 2 — Core game engine
- Server-side spin logic: reel strips, RNG, 20-payline evaluation, wilds
- Pixi reel renderer with spin/stop animations and winning-line highlights
- Bet selector, balance display, spin button, turbo mode
- RTP simulator; tune math to ~96%
- Unit tests for payline evaluation and payouts

### Phase 3 — First theme, fully polished
- **Beach Paradise** complete: art, background, sounds, music
- Full celebration system (all 5 tiers)
- Free spins feature

### Phase 4 — Jackpots & live features
- 4-tier per-player progressive jackpot with live meters
- Jackpot Wheel bonus and the jackpot celebration sequence
- Win broadcasts to all friends and live feed (WebSocket)

### Phase 5 — Remaining themes
- Theme picker lobby with animated preview cards
- Campaign Trail, Semper Fi, Royal Court, High Stakes, Walk of Fame

### Phase 6 — Stats & social
- Profile/stats page with charts
- Leaderboards, Hall of Fame, achievements
- Daily bonus (5,000 credits)

### Phase 7 — Polish & launch
- Mobile layout and touch controls, loading screen, settings (sound, reduce motion)
- Performance pass (asset compression, lazy-loading theme packs)
- Playwright end-to-end tests
- Deploy to Railway with a persistent volume; share the URL with friends

---

## 10. Deployment

1. Connect the GitHub repo to a **Railway** project.
2. One service runs `npm run build && npm start` (builds the client, starts Fastify).
3. Attach a **volume** mounted at `/data`; SQLite lives at `/data/slots.db` so
   players and stats survive redeploys.
4. Railway provides an HTTPS URL (e.g. `slots-xyz.up.railway.app`); optionally
   add a custom domain.
5. Every push to `main` auto-deploys.

Cost for a handful of friends should fit within Railway's hobby tier.

---

## 11. Decisions

| Question | Decision |
|---|---|
| Starting balance & daily bonus | 10,000 credits to start, 5,000 daily bonus |
| Jackpot pools | **Separate per player** (wins still broadcast to friends) |
| Login | Pick your name from a list; no password or PIN |
| Hosting | Railway |
| Themes | Beach Paradise, Campaign Trail (Politics), Semper Fi (Marines), Royal Court (Kings), High Stakes (Cards), Walk of Fame (Famous People) |
