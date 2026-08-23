# Self-hosting openGym

openGym runs in two small Docker containers (a web server and an API) plus a folder where your data is stored. This guide takes you from "just cloned it" to "using it from my phone".

## 1. Run it locally

Requirements: [Docker](https://docs.docker.com/get-docker/) with the Compose plugin.

```bash
git clone https://github.com/rahulcvwebsitehosting/opengymlog
cd opengymlog
cp .env.example .env
docker compose pull   # download prebuilt images — or skip and build from source
docker compose up -d
```

- First start downloads exercise images/GIFs (~140 MB) once into the app.
- Open **http://localhost:8080** and create an account with username/password (or use passkey if you prefer).
- Rather build from source than pull prebuilt images? Skip `docker compose pull` and run
  `docker compose up -d --build` instead — no Node needed locally either way.

Check it's healthy:

```bash
docker compose ps
curl http://localhost:8080/api/health      # {"ok":true,...}
```

Logs: `docker compose logs -f`. Stop: `docker compose down`.

## 2. Authentication options

openGym now supports **username/password** as the primary authentication method (with passkeys as an optional alternative).

**Username/password works everywhere** — no HTTPS requirement for local testing, no browser restrictions. Just open `http://localhost:8080` and create an account.

**Passkeys** (WebAuthn) are still supported for those who prefer them, but they require:
1. Passkeys are bound to an exact **hostname** (`RP_ID`).
2. They only work over **HTTPS** — with one exception: `http://localhost`.

So `http://localhost:8080` works on the machine running Docker, but **another device (your phone) cannot use `http://<your-LAN-ip>:8080`** — that's neither localhost nor HTTPS, so the passkey prompt won't appear. To use passkeys from your phone you need a real HTTPS hostname.

(You can still open it over LAN in **guest mode**, which stores data only in that browser, or use username/password.)

## 3. Expose it over HTTPS

If you want to use passkeys from your phone, or just want proper HTTPS, put openGym behind something that terminates TLS for a hostname you control, then point it at the `web` container.

Set your domain in `.env` and restart:

```bash
# .env
RP_ID=your-domain.com
ORIGIN=https://your-domain.com
WEB_PORT=8080
RP_NAME=openGym
```

```bash
docker compose up -d
```

Visit `https://your-domain.com`, create your account, and add it to your home screen
(iOS: Share → Add to Home Screen · Android: ⋮ → Add to Home screen).

> Changing `RP_ID` later invalidates existing passkeys (they were bound to the old hostname).
> Pick your domain before people register passkeys.

## 4. Multiple users

Anyone who can reach the URL can create their own profile — each gets isolated data. That's the
default: open signup, no admin.

If you'd rather control who gets in, two optional settings in `.env` turn that around:

```bash
ADMIN_UIDS=youruserid      # comma-separated; these users get the admin dashboard
INVITE_ONLY=1              # new profiles need an invite code
```

Register your own account first, then find your id in `./data/db.json` under `users[].id`
and put it in `ADMIN_UIDS`. You'll get an **Admin dashboard** link in Settings: who's training
right now, each user's workout history and body weight, the ability to disable an account (signed
out and locked out everywhere until you re-enable it), and — with `INVITE_ONLY=1` — generating and
revoking invite codes. Existing accounts keep working when you switch invite-only on. Admin access
is gated by your passkey and enforced server-side, so it needs no separate login.

Prefer to keep the whole thing off the open internet? A VPN or an auth proxy (Authelia, Cloudflare
Access…) in front still works.

## 5. Backups

Everything is in `./data`:

```bash
tar czf opengym-backup-$(date +%F).tar.gz data/
```

That archive contains all profiles, credentials and workout history. Restore by unpacking it back
into the project folder. (Individual users can also export their own data as JSON from Settings.)

## 6. Notifications

openGym can push two kinds of alert to your phone/desktop, even when the app isn't open:
rest-timer-over, and a reminder on days you have a workout planned but haven't logged one yet.
Turn it on per-profile in **Settings → Notifications** (requires a signed-in profile and
HTTPS — see section 3).

No setup needed server-side, and nothing to configure per timezone: VAPID keys are generated on
first run and saved to `./data/vapid.json`, and each user's browser reports its own timezone
automatically when they turn the reminder on — it fires at their local time, and follows them if
they travel, regardless of what timezone the server itself runs in.

**Keep screen awake** (Settings → *During a workout*) has the same transport requirement: the
Wake Lock API is only available over HTTPS or on `http://localhost`, so on a plain-LAN-IP
instance the switch shows as unsupported. Nothing to configure server-side either way, and iOS
refuses the lock while the phone is in Low Power Mode.

## 7. Updating

Running prebuilt images:

```bash
git pull                    # picks up compose/config changes
docker compose pull
docker compose up -d
```

Building from source instead:

```bash
git pull
docker compose up -d --build
```

The app shell is versioned (`?v=N`) so clients pick up changes on next load. Your `./data` and the
downloaded media are untouched.

## Mobile app server sync

The Android APK now supports optional server sync. When a user signs in with their username/password in the mobile app, their data automatically syncs with your self-hosted server. No additional configuration needed — just make sure your server is reachable from the phone (HTTPS recommended for production).