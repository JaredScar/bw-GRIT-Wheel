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

- **Sign in with Google**: the entire site requires signing in first. Click **Continue
  with Google** on `/login` and pick your Bitwarden work account. Only verified
  `@bitwarden.com` Google accounts are accepted — a personal Gmail (or any other
  Workspace domain) is turned away and no account is created for it. Once you're
  through, you get a 30-day session, so you won't need to sign in again on the same
  device for a while.
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
- An **admin** (any signed-in user holding the `admin` role — see
  [Roles and admin access](#roles-and-admin-access)) can:
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
backend/    NestJS API (Google OAuth sign-in, nominations, rounds, admin)
frontend/   Angular app (login, nominate form, public feed, rounds/winners, admin + wheel)
docker-compose.yml
```

## Setting up Google sign-in

Signing in with Google is the only way into the app, so you need an OAuth client
before it will start. In the [Google Cloud console](https://console.cloud.google.com/):

1. Pick (or create) a project, then go to **APIs & Services → OAuth consent screen**
   and configure it with a **User type of Internal**. Internal means only accounts in
   the Bitwarden Google Workspace can ever complete the flow, which is a second layer
   of protection on top of the domain check the app does itself.
2. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID** and
   choose **Web application**.
3. Under **Authorized redirect URIs**, add the callback URL. For local development
   that's:

   ```
   http://localhost:4200/api/auth/google/callback
   ```

   Note the port is **4200** (the frontend), not 3000 — `/api/*` is proxied through to
   the backend both by nginx in Docker and by the Angular dev server. Add your
   production URL here too when you deploy (e.g.
   `https://grit.example.com/api/auth/google/callback`).
4. Copy the generated **Client ID** and **Client secret** into `.env` as described
   below.

## Running with Docker (recommended)

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — the OAuth client you created above.
     Both are required; the backend refuses to sign anyone in without them.
   - `GOOGLE_REDIRECT_URI` — must exactly match one of the **Authorized redirect URIs**
     on that OAuth client. Leave it blank to fall back to
     `<FRONTEND_URL>/api/auth/google/callback`.
   - `JWT_SECRET` — a long random secret used to sign session cookies. Generate one
     with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - `ADMIN_EMAILS` — a comma-separated list of `@bitwarden.com` emails that should
     have admin access (create rounds, spin the wheel, manage photos, view
     analytics). Anyone else can still sign in and use the rest of the site, just not
     `/admin`. See [Roles and admin access](#roles-and-admin-access) for how this
     interacts with roles stored in the database.
   - `FRONTEND_URL` — the public URL of the app; people are sent back here after
     signing in with Google.
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

   You'll land on `/login`. Click **Continue with Google** and choose your
   `@bitwarden.com` account to finish signing in.

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

## Roles and admin access

Authorization uses the standard NestJS RBAC pattern: a `Role` enum, a `@Roles()`
decorator, and a global `RolesGuard` that runs after the authentication guard. There
are two roles today, `user` and `admin`, and they're stored on the `users.roles`
column, so **admins can be changed without a redeploy**.

Routes without a `@Roles()` decorator are available to any signed-in Bitwarden
account. Admin-only routes are the round lifecycle (`GET /rounds/current`,
`GET /rounds/:id/wheel`, `POST /rounds`, `POST /rounds/:id/spin`), the photo
directory management endpoints, and analytics.

### How someone becomes an admin

`ADMIN_EMAILS` acts as the **floor**, and the database is where you grant anything
extra:

- On **first sign-in**, a brand new user listed in `ADMIN_EMAILS` is created with the
  `admin` role. After that, their roles are never overwritten by the env var on
  subsequent sign-ins, so database changes stick.
- On **every startup**, anyone on the `ADMIN_EMAILS` list is granted the `admin` role
  if they don't already have it. This backfills accounts that predate the roles
  column and guarantees you can always recover admin access through configuration.
  It's additive, so admins you granted in the database are never revoked by it.

To promote or demote someone directly:

```bash
# Promote
docker compose exec db psql -U postgres -d grit_wheel \
  -c "UPDATE users SET roles='user,admin' WHERE email='someone@bitwarden.com';"

# Demote
docker compose exec db psql -U postgres -d grit_wheel \
  -c "UPDATE users SET roles='user' WHERE email='someone@bitwarden.com';"
```

Changes take effect on the person's **very next request** — the session cookie stores
only a user ID, and roles are read from the database on each request, so nobody needs
to sign out and back in.

One caveat worth remembering: a database-only demotion of someone who is still listed
in `ADMIN_EMAILS` will be undone the next time the backend boots. To demote them for
good, remove them from `ADMIN_EMAILS` as well.

## Running locally without Docker (development)

**Backend**

```bash
cd backend
cp .env.example .env   # point DB_HOST at your local Postgres, set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/JWT_SECRET/ADMIN_EMAILS
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

- **Sign in**: `/login` — click **Continue with Google** and pick your
  `@bitwarden.com` account. You'll stay signed in for 30 days on that device; use
  **Log out** in the header to end your session early.
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
- **Admin**: `/admin` — only visible/usable if you hold the `admin` role. From there
  you can:
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

- Access is gated by Google sign-in: only someone who can authenticate against a real
  `@bitwarden.com` Google account can get in, and every nomination/agree action is
  attributed to that verified session — there's no "type any email you like" trust
  model.
- The domain restriction is enforced **server-side** on the ID token Google returns.
  The `hd=bitwarden.com` parameter the app sends only pre-filters Google's account
  chooser and can't be relied on, so the backend independently re-checks both the
  email domain and Google's `email_verified` flag before creating a session.
- Sign-in requests are protected against CSRF with a random `state` value stored in a
  short-lived `grit_oauth_state` cookie and compared on the callback.
- The app asks Google only for `openid email profile`, doesn't request offline access,
  and keeps no Google access or refresh tokens — the ID token is verified once at
  sign-in and discarded. A person's display name is picked up from their Google
  profile and refreshed on each sign-in.
- Sessions are a signed JWT stored in an `httpOnly` cookie (`grit_session`), valid for
  30 days; there's no separate "remember me" toggle.
- Authorization is role-based (`user` / `admin`) with roles persisted per user in the
  database and enforced by a global `RolesGuard`; `ADMIN_EMAILS` seeds and re-grants
  the `admin` role rather than being checked directly on each request. See
  [Roles and admin access](#roles-and-admin-access). There are no finer-grained
  permissions — anyone with `admin` has full admin rights.
- Roles are read from the database on every request rather than being baked into the
  session JWT, so promoting or demoting someone takes effect immediately without
  forcing them to sign in again.
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
- `synchronize: true` is enabled on the TypeORM connection for simplicity in this
  internal tool. For a longer-lived production deployment, consider switching to
  proper migrations.
- If you're upgrading an install that used the old magic-link sign-in, the now-unused
  `magic_link_tokens` table is left behind rather than dropped automatically. It's
  harmless, but you can clean it up with
  `docker compose exec db psql -U postgres -d grit_wheel -c 'DROP TABLE IF EXISTS magic_link_tokens;'`.
