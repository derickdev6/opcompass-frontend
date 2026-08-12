# OP Compass — Frontend

The web interface for **OP Compass** (Operations Compass), a tool for the daily
admin and management work an operations team does over and over.

The API lives in a separate repository,
[`opcompass-backend`](../opcompass-backend).

---

## Current scope

Two screens, and nothing else yet:

- a sign-in screen
- a welcome page that proves the app and the API are talking

Everything else — dashboards, charts, the actual operations features — comes
later, once the backend has a domain model to show.

Built with Vite, React and TypeScript, styled with Tailwind and
[shadcn/ui](https://ui.shadcn.com). It builds to plain static files; there is
no Node process in production.

---

## Getting started

You need **Node 20+** and the backend running.

**1. Install dependencies**

```bash
npm install
```

**2. Start the backend**

In `opcompass-backend`, follow its README until `python manage.py runserver` is
up on port 8000.

**3. Start the dev server**

```bash
npm run dev
```

The app is on http://localhost:5173. Calls to `/api` are proxied to Django, so
the browser sees a single origin and there is no CORS to fight with.

Sign in with the superuser you created in the backend.

### Staying signed in

The access token is kept **in memory only** — never in `localStorage`, where an
injected script could read it. The refresh token is an `HttpOnly` cookie that
JavaScript cannot touch, so the browser can use it but no script can steal it.

On page load the app quietly trades that cookie for a new access token, which
is why **a refresh keeps you signed in** and why you see a brief "Loading…"
first. If the backend is not running, that is where the app will sit.

---

## Commands

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run preview
```

```bash
npm run lint
```

Add a shadcn component:

```bash
npx shadcn@latest add dialog
```

---

## How it is put together

```
src/
  components/ui/   shadcn components. Generated — you own them.
  lib/
    api.ts         The only place that calls fetch
    auth.tsx       Session state
    utils.ts       cn() helper
  pages/           LoginPage, WelcomePage
  App.tsx          Loading gate, then picks which screen renders
  index.css        Tailwind and design tokens
nginx/             Production server config
```

There is no router. With two screens, "signed in or not" decides which one
renders. A router goes in when a third screen needs its own URL.

---

## Running in Docker

Create the shared network once:

```bash
docker network create opcompass
```

Start the backend first, then:

```bash
docker compose up -d --build
```

The app is on `http://<host>/`. nginx serves the bundle, proxies `/api` and
`/admin` to Django, caches fingerprinted assets for a year, and never caches
`index.html`, so a deploy takes effect immediately.

`VITE_` variables are **baked into the bundle at build time**, not read at
runtime. Changing one means rebuilding the image. Nothing secret may go in one
— everything in the bundle is public.

---

## Contributing

Run `npm run build` before opening a pull request; it is the type check.

New API calls go through `lib/api.ts`. Nothing else should call `fetch`.

Update `ClaudeGuide.md` when you change structure or conventions.
