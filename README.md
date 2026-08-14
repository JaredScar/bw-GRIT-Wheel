# Bitwarden GRIT Award App

A self-hosted replacement for the "nominate via Google Form, spin a wheel" GRIT award
process. People submit nominations (optionally anonymously), everyone can see every
nomination that's ever been submitted, and an admin spins an animated wheel to pick
the winner for each all-hands round.

**GRIT** stands for:

- **Gratitude** – Celebrate contributions, champion the open source community, and cultivate an inclusive environment.
- **Responsibility** – Do the right thing and deliver the best work for Bitwarden customers and each other.
- **Innovation** – Thinking boldly and pursuing creative solutions that push security forward for customers and the community.
- **Trust** – Lead with integrity, honesty, and transparency to give every user security confidence.
- **Grit** – Showing passion, perseverance, and adaptability to help push Bitwarden forward.

The winner of each all-hands round receives $100 towards the Bitwarden swag store.

## Stack

- **Frontend**: Angular 18 (standalone components), served by nginx in production
- **Backend**: NestJS + TypeORM
- **Database**: PostgreSQL
- Everything runs via Docker Compose

## How it works

- **Sign in with a magic link**: the entire site requires signing in first. Enter your
  `@bitwarden.com` email on `/login`, and a one-click sign-in link is emailed to you
  (or logged to the backend console if SMTP isn't configured yet — see below). The
  link is single-use and expires after 15 minutes; once verified you get a 30-day
  session, so you won't need to sign in again on the same device for a while.
- **Anyone signed in** can submit a nomination for someone else (the nominee also
  needs a `@bitwarden.com` email). The nominator can choose to submit anonymously —
  their name is hidden from the public view (their verified identity is still
  recorded internally), but the nominee is always shown.
- **Every nomination is public immediately** — a feed shows every nomination ever
  submitted (filterable by GRIT category or by round, and searchable by nominee,
  nominator, or reason text), regardless of who wins.
- **Agree with a nomination** ("+1", Reddit-style): anyone signed in can react to a
  nomination to show they agree — no extra prompt, since you're already
  authenticated. The feed can be sorted by **Newest** or **🔥 Trending** (most
  agreed-with first) to surface the most popular nominations. Reactions only work on
  nominations in the **current, still-open round** — once a round is closed, its
  nomination tallies are locked in.
- **Profile pages** (`/people/:email`): click any nominee's name/photo to see a
  "wall of fame" — every nomination they've ever received, their total agree count,
  a breakdown by GRIT category, and any rounds they've won.
- **Leaderboard** (`/leaderboard`): a fun, all-time view of the most-nominated people,
  the biggest crowd favorites (most agrees), the top public nominators, and a
  "champion" for each GRIT category.
- **Nominee autocomplete**: the nomination form suggests previously-nominated people
  by email as you type, auto-filling their name to cut down on typos.
- **Confetti + sound** when the admin reveals a wheel winner, for a little extra
  celebration at the all-hands.
- **Shareable winner card**: after a spin (or from `/rounds` for any past winner),
  generate a social-media-ready image card with the winner's photo, name, and round —
  either shared directly via the browser's share sheet or downloaded as a PNG.
- **Slack notifications** (optional): if `SLACK_WEBHOOK_URL` is configured, the app
  posts to a Slack channel when a nomination is submitted, a new round opens, and when
  the wheel picks a winner.
- Nominations are grouped into **rounds** (one per all-hands meeting). New nominations
  automatically go into whichever round is currently "open."
- An **admin** (any signed-in user whose email is on the `ADMIN_EMAILS` allow-list) can:
  - Start a new round (this closes the previous one)
  - Spin an animated wheel — choose between one **equally-weighted** slice per unique
    nominee, or a slice **weighted by nomination count** (people nominated more times
    get a bigger slice and better odds) — the backend picks the random winner so
    results can't be manipulated from the browser
  - See the full history of rounds and winners
  - Upload a headshot for anyone by their `@bitwarden.com` email (the **Photo
    directory** section on `/admin`) — once uploaded, that person's photo shows up
    automatically next to their nominations and any round they've won
  - View an **Analytics** dashboard (also on `/admin`) with totals (nominations,
    rounds, agrees, unique nominees/nominators, average nominations per round) and bar
    charts of nominations by GRIT category and by round

## Project layout

```
backend/    NestJS API (auth/magic-link, nominations, rounds, admin)
frontend/   Angular app (login, nominate form, public feed, rounds/winners, admin + wheel)
docker-compose.yml
```

## Running with Docker (recommended)

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:
   - `JWT_SECRET` — a long random secret used to sign session cookies. Generate one
     with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - `ADMIN_EMAILS` — a comma-separated list of `@bitwarden.com` emails that should
     have admin access (create rounds, spin the wheel, manage photos, view
     analytics). Anyone else can still sign in and use the rest of the site, just not
     `/admin`.
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` — an SMTP
     relay used to send magic-link sign-in emails (e.g. a Google Workspace SMTP relay,
     or a transactional email provider). **If left blank, magic links aren't emailed —
     they're logged to the backend console instead** (`docker compose logs backend`),
     which is convenient for local testing but you'll want real SMTP configured before
     rolling this out to the team.
   - `COOKIE_SECURE` — set to `true` only if the site is served over HTTPS.

   Optionally, set `SLACK_WEBHOOK_URL` to a Slack
   [Incoming Webhook](https://api.slack.com/messaging/webhooks) URL to get notified in
   a channel whenever a nomination is submitted, a round opens, or a winner is picked.
   Leave it blank to disable Slack notifications entirely.

2. Build and start everything:

   ```bash
   docker compose up --build
   ```

3. Open the app:
   - Frontend: http://localhost:4200
   - Backend API (optional direct access): http://localhost:3000/api

   You'll land on `/login`. Enter your `@bitwarden.com` email and submit. If you
   haven't configured SMTP, grab the sign-in link from the backend logs instead of
   your inbox:

   ```bash
   docker compose logs -f backend
   ```

   Look for a line like `Magic link for you@bitwarden.com: http://localhost:4200/auth/verify?token=...`
   and open that URL in your browser to finish signing in.

The frontend container proxies `/api/*` requests to the backend container, so the
Angular app always talks to the API on the same origin it's served from.

Data is persisted in a Docker named volume (`grit_wheel_db_data`), so nominations and
round history survive `docker compose down` / restarts. Use
`docker compose down -v` if you ever want to wipe the database.

### Optional example data

`backend/src/seed.ts` seeds a handful of **fictional** completed rounds (made-up
names, emails, and nomination text) so a fresh install has something to look at
right away, then opens a fresh round for new nominations. It's entirely optional,
safe to re-run (rounds are matched/skipped by title), and easy to skip if you'd
rather start from a completely empty database.

```bash
docker compose exec backend node dist/seed
```

Edit `seedRounds` in that file to add your own organization's real historical
winners — just don't commit real employee names/emails/nomination text if this
repo (or your fork of it) is public.

## Running locally without Docker (development)

**Backend**

```bash
cd backend
cp .env.example .env   # point DB_HOST at your local Postgres, set JWT_SECRET/ADMIN_EMAILS
npm install
npm run start:dev
```

You'll need a local PostgreSQL instance matching the `.env` values (or run just the
`db` service with `docker compose up db`).

**Frontend**

```bash
cd frontend
npm install
npm start   # proxies /api to http://localhost:3000 (see proxy.conf.json)
```

Then visit http://localhost:4200.

## Using the app

- **Sign in**: `/login` — enter your `@bitwarden.com` email and click the link sent to
  your inbox (or logged to the backend console, if SMTP isn't set up). You'll stay
  signed in for 30 days on that device; use **Log out** in the header to end your
  session early.
- **Nominate**: once signed in, go to `/nominate`, fill out the form, and submit. The
  nominee's email must end in `@bitwarden.com`; your own identity comes from your
  session automatically.
- **Nominations**: `/nominations` shows every nomination publicly, filterable by GRIT
  category, searchable, and sortable by Newest or Trending. Click the 👍 button on a
  nomination from the current round to agree with it. Click a nominee's name/photo to
  see their full profile.
- **Leaderboard**: `/leaderboard` — most-nominated people, crowd favorites, top
  nominators, and category champions.
- **Rounds & Winners**: `/rounds` lists every round, its status, and the winner once
  the wheel has been spun.
- **Admin**: `/admin` — only visible/usable if your email is on the `ADMIN_EMAILS`
  allow-list. From there you can:
  - Start a new round for the upcoming all-hands
  - Spin the wheel for the current round once nominations are in — toggle "Weight
    slices by number of nominations" beforehand if you want people with more
    nominations to have better odds instead of one equal slice per person
  - View round history
  - Share a winner card as a PNG (or via your device's share sheet) right after a spin,
    or later from `/rounds`
  - Manage the **photo directory** — upload, replace, or remove a headshot for any
    `@bitwarden.com` email. People who've been nominated show up automatically so you
    can add their photo without retyping their email; you can also add a photo for
    someone by email before they've ever been nominated.
  - Check the **Analytics** section for totals and category/round breakdowns

## Notes & assumptions

- Access is gated by a magic-link login: only someone who can receive email at a real
  `@bitwarden.com` address can sign in, and every nomination/agree action is
  attributed to that verified session — there's no more "type any email you like"
  trust model.
- Sessions are a signed JWT stored in an `httpOnly` cookie (`grit_session`), valid for
  30 days; there's no separate "remember me" toggle.
- Admin access is a simple email allow-list (`ADMIN_EMAILS`), not a separate
  role/permissions system — anyone on the list has full admin rights.
- Only the **nominator's** identity can be hidden (anonymous nominations); the
  **nominee** is always shown, since the whole point is public recognition.
- Nominations are visible immediately upon submission — there is no moderation queue.
- By default, the wheel gives each **unique nominee** in a round one equally-weighted
  slice, regardless of how many times they were nominated within that round. The admin
  can opt into weighting slices by nomination count instead, on a per-spin basis; the
  mode used is recorded on the round for transparency.
- Slack notifications are best-effort: if `SLACK_WEBHOOK_URL` isn't set, or the
  webhook call fails, the app logs a warning and continues normally — Slack is never a
  hard dependency for nominating, opening rounds, or spinning the wheel.
- Magic-link emails degrade the same way: if SMTP isn't configured (or a send fails),
  the backend logs the link instead of emailing it, so the app stays usable while you
  finish setting up a real mail provider.
- `synchronize: true` is enabled on the TypeORM connection for simplicity in this
  internal tool. For a longer-lived production deployment, consider switching to
  proper migrations.
