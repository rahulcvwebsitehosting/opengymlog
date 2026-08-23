# openGym

A gym and body-weight tracker you run yourself. No accounts on someone else's server. No subscription. No ads. Just your data, on your phone and your computer.

<div align="center">
<img src="assets/banner.png" alt="openGym banner" width="720">
<br>
<br>

**Plan your week, run guided workouts, track your weight over time.**
- On your phone or laptop
- Synced across your devices
- Behind your own username/password login
- `docker compose up` to start

[![License: MIT](https://img.shields.io/badge/license-MIT-a3e635?style=flat-square)](LICENSE)
![Self-hosted](https://img.shields.io/badge/self--hosted-%F0%9F%8F%A0-60a5fa?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-installable-a78bfa?style=flat-square)
![React](https://img.shields.io/badge/React-19-38bdf8?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=flat-square)
![No tracking](https://img.shields.io/badge/telemetry-none-f472b6?style=flat-square)
<br>
<br>

[![GitHub last commit](https://img.shields.io/github/last-commit/rahulcvwebsitehosting/opengymlog?style=flat-square)](https://github.com/rahulcvwebsitehosting/opengymlog)
[![GitHub stars](https://img.shields.io/github/stars/rahulcvwebsitehosting/opengymlog?style=flat-square)](https://github.com/rahulcvwebsitehosting/opengymlog/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/rahulcvwebsitehosting/opengymlog?style=flat-square)](https://github.com/rahulcvwebsitehosting/opengymlog/issues)
</div>

<br>

## About

openGym is an app you run on your own equipment. It started as a simple way to log workouts and track body weight without subscribing to someone else's service.

**This fork adds:**
- Username/password login (you can still use passkeys if you prefer)
- Mobile app server sync — your data syncs with your self-hosted server when you're signed in
- MIT license (changed from AGPL)
- OIDC-ready architecture for future integration with authentication providers

**Features:**
- Track body weight with goal line progress
- Weekly workout plan (reschedule any day)
- Guided workouts with timers and PR detection
- 1,324 exercises with animated demos
- Filter exercises by equipment you own
- Timed exercises (planks, hangs, carries)
- Supersets and cardio logging
- Progression rules (linear, Greyskull LP, double progression)
- Estimated 1RM per exercise
- RIR/RPE effort tracking per set
- Muscle map — see which muscles you've trained
- Activity heatmap (GitHub-style year view)
- 12 languages available
- Import from FitNotes, Strong, Hevy, or Apple Health
- Export your data as JSON
- Guest mode (no account needed)
- Screen stays awake during workouts
- Rest-timer notifications
- Optional workout-day reminders
- Username/password or passkey login
- Admin dashboard for instance owners
- Light/dark themes and 8 accent colors
- Hand-drawn icon set

## Quick start (self-host)

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/rahulcvwebsitehosting/opengymlog
cd opengymlog
cp .env.example .env
docker compose pull   # download prebuilt images — or skip and build from source
docker compose up -d
```

Open **http://localhost:8080**, tap **Create account**, and you're in.
First launch downloads exercise media (~140 MB) once.
Prefer building the images yourself? Drop the `pull` step and run
`docker compose up -d --build` — you don't need Node or a build step locally either way.

Want it reachable from your phone? See **docs/SELF_HOSTING.md** for adding HTTPS.

## Mobile app (no server required, but can sync)

The same codebase also builds a **standalone mobile app** (Capacitor):
- No account, no sync, no backend — everything stays on the phone
- Native workout-day reminders and share-sheet backups
- Self-hosting gets you multi-device sync and profiles

**New in this fork:** When you sign in with your username/password in the mobile app, your data automatically syncs with your self-hosted server!

- **Android:** Download the APK and sideload it — openGym is not on the Play Store.
  Or build it yourself: see **docs/MOBILE.md**.
- **iPhone:** Add it to your home screen from Safari (it's a full PWA), or build
  the native app from Xcode — see **docs/MOBILE.md**.

## How it works

- **frontend/** — React + Vite (React Router + Zustand), built to static files inside Docker
- **api/** — Node with no framework, using bcrypt for passwords, JWT for mobile tokens, storing everything as plain JSON files under `./data`
- **web/** — a multi-stage image that builds the frontend and serves it with nginx, proxying `/api` to the backend so it's all on one origin

Your data lives in `./data` on your host: `db.json` (profiles + credentials), `state-<user>.json`
(each user's plan, workouts, body weight, settings), and `secret` (the session-cookie key).
**Back up `./data` and you've backed up everything.**

## Configuration

All via `.env` (see `.env.example`):

| Variable | What it is | Default |
|---|---|---|
| `RP_ID` | Hostname passkeys are bound to | `localhost` |
| `ORIGIN` | Full URL the app is served from | `http://localhost:8080` |
| `WEB_PORT` | Host port for the web UI | `8080` |
| `RP_NAME` | Name shown in the passkey prompt | `openGym` |
| `ADMIN_UIDS` | User ids that get the admin dashboard (comma-separated) | *(none)* |
| `INVITE_ONLY` | Require an invite code to create a profile | *(off)* |
| `SESSION_DAYS` | Session cookie lifetime in days | `90` |

Push notification keys are generated on first run and saved to `./data/vapid.json` — nothing to set.

## License

[MIT License](LICENSE) — free and open source. You can self-host, use, modify, share, and even sell it.

Exercise images/GIFs are fetched from the upstream dataset and keep their own terms — see **NOTICE.md**.

## Credits

**openGym by Rahul Shyam** — Civil engineer who codes. Built AI apps, browser games, client sites, and construction tools.

## Roadmap

Rough ideas for future:
- Percentage / training-max programming (5/3/1-style) on top of the progression engine
- More starter plans (upper/lower, full-body, 5×5)
- Body measurements (waist, arms…) alongside weight
- Per-exercise notes & plate calculator
- Exercise instructions in German & Portuguese
- Full OIDC integration (Authentik, Keycloak, etc.)