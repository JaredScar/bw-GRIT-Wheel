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
- **Anyone signed in** can submit a nomination for someone else by picking them from
  a searchable **nominee directory** — there's no free-text name or email field on the
  form, so there's nothing to typo or mismatch. The nominator can choose to submit
  anonymously — their name is hidden from the public view (their verified identity is
  still recorded internally), but the nominee is always shown. A nomination can call
  out more than one GRIT value at once.
- **The nominee directory** (see [Importing the nominee directory](#importing-the-nominee-directory))
  is imported by an admin from a CSV export of the company's Slack workspace member
  list. It's the only source of who can be nominated — if someone's missing (e.g. a
  brand-new hire), an admin re-imports an updated CSV to add them.
- **Every nomination is public immediately** — a feed shows every nomination ever
  submitted (filterable by GRIT category or by round, and searchable by nominee,
  nominator, or reason text), regardless of who wins.
- **Agree with a nomination** ("+1", Reddit-style): anyone signed in can react to a
  nomination to show they agree — no extra prompt, since you're already
  authenticated. Reactions only work on nominations in the **current, still-open
  round** — once a round is closed, its nomination tallies are locked in.
- **Profile pages** (`/people/:email`): click any nominee's name/photo to see a
  "wall of fame" — every nomination they've ever received, their total agree count,
  a breakdown by GRIT category, and any rounds they've won.
- **Leaderboard** (`/leaderboard`): a fun, all-time view of the most-nominated people,
  the biggest crowd favorites (most agrees), the top public nominators, and a
  "champion" for each GRIT category.
- **Profile photos come from Google**: there's nothing to upload or manage. Whoever
  signs in brings their Google profile picture with them, and it's refreshed on each
  sign-in. Anyone who hasn't signed in yet — including someone who's been nominated
  but never opened the app — shows a coloured initials placeholder instead.
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
  - Import/refresh the nominee directory from a Slack CSV export (see
    [Importing the nominee directory](#importing-the-nominee-directory))
  - Start a new round (this closes the previous one)
  - Spin an animated wheel — choose between one **equally-weighted** slice per unique
    nominee, or a slice **weighted by nomination count** (people nominated more times
    get a bigger slice and better odds) — the backend picks the random winner so
    results can't be manipulated from the browser
  - See the full history of rounds and winners
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
     have admin access (create rounds, spin the wheel, view analytics). Anyone
     else can still sign in and use the rest of the site, just not
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
`GET /rounds/:id/wheel`, `POST /rounds`, `POST /rounds/:id/spin`) and analytics.

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

## Deploying to production

The production setup is a single VM running the same containers as local
development, with a [Caddy](https://caddyserver.com/) container added in front to
terminate TLS and renew certificates automatically:

```
Internet -> :443 caddy -> frontend (nginx) -> /api/* -> backend -> db
                                           -> /*     static Angular bundle
```

Four files drive it:

| File | Purpose |
| --- | --- |
| `docker-compose.prod.yml` | Pulls prebuilt images instead of building; adds Caddy; keeps the database and API off the public internet |
| `Caddyfile` | TLS termination, security headers, reverse proxy to the frontend |
| `.env.production.example` | Template for the VM's `.env` |
| `.github/workflows/deploy.yml` | Builds, pushes, and rolls out a new version on every `v*` tag — see [Automated deploys](#7-automated-deploys-with-github-actions) |

The API deliberately publishes no ports here. In `docker-compose.yml` the backend
maps `3000:3000` for convenience, which on a public host would expose the API
over plaintext HTTP alongside the TLS-terminated site.

### 1. Build and push images

Images are pulled, never built, on the VM — an Angular production build needs
more memory than a small instance has to spare. Create the registry once:

```bash
gcloud artifacts repositories create grit \
  --repository-format=docker --location=us-central1
gcloud auth configure-docker us-central1-docker.pkg.dev
```

Then, from a workstation (`--platform linux/amd64` matters on Apple Silicon,
otherwise you will produce arm64 images the VM cannot run):

```bash
REPO=us-central1-docker.pkg.dev/YOUR_PROJECT/grit
docker buildx build --platform linux/amd64 -t $REPO/backend:v1.0.0  --push ./backend
docker buildx build --platform linux/amd64 -t $REPO/frontend:v1.0.0 --push ./frontend
```

### 2. Provision the VM

```bash
gcloud compute addresses create grit-ip --region=us-central1

gcloud compute instances create grit-wheel \
  --zone=us-central1-a --machine-type=e2-small \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-size=30GB --boot-disk-type=pd-balanced \
  --address=grit-ip --tags=grit-web \
  --scopes=https://www.googleapis.com/auth/cloud-platform

gcloud compute firewall-rules create grit-allow-web \
  --allow=tcp:80,tcp:443,udp:443 --target-tags=grit-web --source-ranges=0.0.0.0/0

gcloud compute firewall-rules create grit-allow-iap-ssh \
  --allow=tcp:22 --target-tags=grit-web --source-ranges=35.235.240.0/20
```

SSH goes through IAP rather than a public port 22, and `udp:443` is what lets
Caddy serve HTTP/3. Install Docker on the instance with
`curl -fsSL https://get.docker.com | sudo sh`, then grant the VM's service
account `roles/artifactregistry.reader` so it can pull.

### 3. Point DNS at it

Create an A record for your hostname pointing at the reserved IP
(`gcloud compute addresses describe grit-ip --region=us-central1`). **Do this
before starting Caddy** — it requests a certificate on first boot, and ACME will
fail in a retry loop if the name does not resolve yet.

If you are waiting on DNS, you can still bring the stack up for a smoke test by
setting `SITE_ADDRESS=:80` and `COOKIE_SECURE=false`, which serves plain HTTP
and skips certificates entirely. Google sign-in will not work in that state —
Google rejects non-HTTPS redirect URIs for anything but localhost — so the app
loads but you cannot get past `/login`.

### 4. Register the production callback

Add the production URL to your OAuth client's **Authorized redirect URIs**:

```
https://your-host.example.com/api/auth/google/callback
```

The path is derived from the *frontend* origin, not the backend's, because the
callback arrives through the nginx proxy — that is why there is no `:3000` in it.

Note that the **Internal** user type recommended above is only selectable when
the Google Cloud project belongs to a Workspace organization. In a personal
project you must use **External**, and you should move it from *Testing* to
*In production* or you are capped at 100 manually-added test users. That is
still safe here: the app requests only the non-sensitive `openid email profile`
scopes, and the backend independently rejects any address that is not a verified
`@bitwarden.com` account before it will create a session.

### 5. Deploy

The VM holds `docker-compose.prod.yml` and `Caddyfile` as plain files rather than
a git checkout. Automated deploys copy those two files up on every release, which
would leave a clone permanently dirty and make `git pull` conflict, so copy them
instead of cloning. From your workstation:

```bash
gcloud compute ssh grit-wheel --zone=us-central1-a --tunnel-through-iap \
  --command 'sudo mkdir -p /opt/grit && sudo chown $USER /opt/grit'

gcloud compute scp docker-compose.prod.yml Caddyfile .env.production.example \
  grit-wheel:/opt/grit/ --zone=us-central1-a --tunnel-through-iap
```

Then on the VM, fill in the environment and start the stack:

```bash
cd /opt/grit
mv .env.production.example .env   # then fill it in
sudo docker compose -f docker-compose.prod.yml up -d
sudo docker compose -f docker-compose.prod.yml logs -f caddy   # watch cert issuance
```

Keep the `IMAGE_TAG=` line in that `.env` even once deploys are automated — the
workflow rewrites it in place and fails loudly if the line is missing.

To ship a new version by hand, push new image tags, then update `IMAGE_TAG` in
`/opt/grit/.env` and run:

```bash
sudo docker compose -f docker-compose.prod.yml pull
sudo docker compose -f docker-compose.prod.yml up -d
```

### 6. Back up the database

There are no uploaded files anywhere — headshots come from Google and are fetched
on demand — so a database dump is a complete backup. A nightly cron is enough:

```bash
sudo docker compose -f /opt/grit/docker-compose.prod.yml exec -T db \
  pg_dump -U postgres grit_wheel | gzip > /tmp/grit-$(date +%F).sql.gz
gcloud storage cp /tmp/grit-$(date +%F).sql.gz gs://your-backup-bucket/
```

Because `synchronize: true` applies schema changes automatically at boot, take a
dump before deploying any release that changes an entity. The automated deploy
below does this for you on every release.

### 7. Automated deploys with GitHub Actions

Once the VM is running, `.github/workflows/deploy.yml` takes over the manual
steps above. Pushing a `v*` tag runs the backend test suite, builds and pushes
both images (tagged with the tag and `latest`), copies `docker-compose.prod.yml`
and `Caddyfile` up to `/opt/grit`, dumps the database, rewrites `IMAGE_TAG` in
the VM's `.env`, pulls and restarts, and finally polls the site until
`/api/auth/me` answers `401` — an unauthenticated 401 means the backend booted,
reached the database, and is being proxied correctly.

```bash
git tag v1.0.1 && git push origin v1.0.1
```

The workflow runs on tag pushes only. **Do not add `pull_request` to its
triggers**: this repository is public, and a workflow holding `id-token: write`
that runs on PRs would let anyone who opens one mint a Google Cloud access token.
Note that only the backend tests gate a release — a frontend compile error
surfaces later, when its image is built, which is still before the VM is touched.

#### Authentication

CI authenticates with Workload Identity Federation, so there are **no GitHub
secrets and no service account keys** to rotate. Create the pool, provider, and
deploy service account once:

```bash
PROJECT_ID=your-project
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
GITHUB_REPO=JaredScar/bw-GRIT-Wheel

gcloud iam service-accounts create grit-deployer --display-name='GRIT deploy (GitHub Actions)'
SA=grit-deployer@$PROJECT_ID.iam.gserviceaccount.com

gcloud iam workload-identity-pools create github --location=global
gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository' \
  --attribute-condition="assertion.repository=='$GITHUB_REPO'"

# Without the attribute condition above, a workflow in *any* GitHub repository
# could impersonate this service account.
gcloud iam service-accounts add-iam-policy-binding $SA \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO"

for ROLE in roles/artifactregistry.writer roles/compute.osAdminLogin \
            roles/iap.tunnelResourceAccessor roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="$ROLE"
done
```

`compute.osAdminLogin` rather than plain `osLogin` is deliberate: the deploy
steps run `sudo docker compose`, and only the admin variant grants passwordless
sudo over SSH.

#### Repository configuration

The deploy job targets a GitHub Environment named `production`, so create it
under **Settings → Environments** (a good place to add required reviewers if you
want a human to approve each release). Then add these as repository or
environment **variables** — none of them are secrets:

| Variable | Example | Purpose |
| --- | --- | --- |
| `GCP_WIF_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/github/providers/github` | Identity pool provider CI presents its OIDC token to |
| `GCP_SERVICE_ACCOUNT` | `grit-deployer@your-project.iam.gserviceaccount.com` | Service account CI impersonates |
| `IMAGE_REPO` | `us-central1-docker.pkg.dev/your-project/grit` | Artifact Registry path images are pushed to |
| `GCP_INSTANCE` | `grit-wheel` | VM name for `scp`/`ssh` |
| `GCP_ZONE` | `us-central1-a` | Zone that VM lives in |
| `SITE_URL` | `https://grit.example.com` | Target for the post-deploy smoke test |

`IMAGE_REPO` is configured twice — here, and in the VM's `/opt/grit/.env`. CI
pushes to this one while Compose pulls using the VM's, so if they disagree the
deploy appears to succeed while the VM quietly keeps running the old images.

## Using the app

- **Sign in**: `/login` — click **Continue with Google** and pick your
  `@bitwarden.com` account. You'll stay signed in for 30 days on that device; use
  **Log out** in the header to end your session early.
- **Nominate**: once signed in, go to `/nominate`, fill out the form, and submit. You
  only need the nominee's name (no email); check every GRIT value that applies. Your
  own identity comes from your session automatically.
- **Nominations**: `/nominations` shows every nomination publicly, filterable by GRIT
  category and searchable. Click the 👍 button on a nomination from the current round
  to agree with it. Click a nominee's name/photo to see their full profile.
- **Leaderboard**: `/leaderboard` — most-nominated people, crowd favorites, top
  nominators, and category champions.
- **GRIT Hall of Names**: `/rounds` lists every round, its status, and the winner
  once the wheel has been spun.
- **Admin**: `/admin` — only visible/usable if you hold the `admin` role. From there
  you can:
  - Start a new round for the upcoming all-hands
  - Spin the wheel for the current round once nominations are in — toggle "Weight
    slices by number of nominations" beforehand if you want people with more
    nominations to have better odds instead of one equal slice per person
  - View round history
  - Share a winner card as a PNG (or via your device's share sheet) right after a spin,
    or later from `/rounds`
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
  sign-in and discarded. A person's display name and profile picture URL are picked
  up from their Google profile and refreshed on each sign-in.
- Profile photos come from Google and there is **no upload feature**. That means a
  photo only exists for someone who has signed in at least once. Nominees are stored
  as free-text emails on the nomination with no link to a user account, so anyone who
  has never opened the app shows an initials placeholder — including, potentially, a
  round winner. Coverage starts empty and fills in as people sign in.
- Avatars are proxied through `GET /api/avatars/:email` rather than linking Google's
  CDN directly. Serving them same-origin is what keeps the winner card's canvas
  export working, since that draws the image with `crossOrigin = 'anonymous'` before
  calling `toBlob()`. Responses are cached in memory for an hour (five minutes for
  misses) so a busy feed doesn't fan out to one request per card.
- Because the picture URL is only refreshed at sign-in and sessions last 30 days, a
  changed Google avatar can take up to a month to appear. Google also rotates these
  URLs; a stale one 404s and falls back to initials until that person signs in again.
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
- If you're upgrading an install that predates Google-sourced avatars, the now-unused
  `person_photos` table is left behind rather than dropped automatically, since
  `synchronize` only manages tables it still has entities for. It's harmless, but you
  can reclaim the space (uploaded images were stored in it as `bytea`) with
  `docker compose exec db psql -U postgres -d grit_wheel -c 'DROP TABLE IF EXISTS person_photos;'`.