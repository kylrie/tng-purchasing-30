# QR App — Post-Deploy Readiness Checklist

**Run this every time before a live demo/meeting and right after any production hosting deploy.**
Goal: never let a customer/staff phone hit a stale bundle or a raw Vite/config screen.

Production URL: `https://tng-systems.web.app` · Fun Roof route: `https://tng-systems.web.app/funroof`

---

## 0. Build the RIGHT way (prevents the #1 root cause)

The worst incidents come from a **config-less build** (built in a directory that has no
`.env.production`, so `VITE_FIREBASE_*` are empty → the app can't init Firebase) or a
**stale bundle** (old `index.html` pointing at replaced chunks).

- [ ] Build from a checkout that HAS `functions/.env.tng-systems` **and** root `.env.production`
      (contains `VITE_FIREBASE_DATABASE_ID=tng-systems` + the `VITE_FIREBASE_*` keys).
      Never deploy hosting from a fresh worktree/CI dir that lacks `.env.production`.
- [ ] `npm run build -- --mode production`
- [ ] Sanity-check the build actually baked in the Firebase key (should print nothing/OK):
      `node -e "const s=require('fs').readFileSync('dist/assets/'+require('fs').readdirSync('dist/assets').find(f=>f.startsWith('index-')&&f.endsWith('.js')),'utf8'); process.exit(/dummy-api-key/.test(s)&&!/AIza/.test(s)?1:0)"`
      (fails if the bundle shipped the dummy key with no real key — i.e. a config-less build).
- [ ] Deploy hosting ONLY (never the generic `npm run deploy:*` scripts):
      `npx firebase deploy --only hosting:production`
- [ ] Do **not** deploy staging or functions as part of a hosting-only change.

---

## 1. Verify caching headers are live (the shell must revalidate)

Firebase header globs match the REQUEST path; SPA routes are served the rewritten shell.
The shell + service worker + manifest must be `no-cache`; hashed `/assets/**` must be immutable.

```bash
# Shell + SW + manifest → must be Cache-Control: no-cache
curl -sI https://tng-systems.web.app/            | grep -i cache-control
curl -sI https://tng-systems.web.app/funroof     | grep -i cache-control
curl -sI https://tng-systems.web.app/index.html  | grep -i cache-control
curl -sI https://tng-systems.web.app/sw.js       | grep -i cache-control
curl -sI https://tng-systems.web.app/manifest.webmanifest | grep -i cache-control
# A hashed asset → must be public, max-age=31536000, immutable + correct JS MIME
curl -sI "https://tng-systems.web.app/assets/<some-hashed>.js" | grep -iE 'cache-control|content-type'
```

- [ ] `/`, `/funroof`, `/index.html`, `/sw.js`, `/manifest.webmanifest` → `no-cache`
- [ ] `/assets/*.js` → `immutable` **and** `content-type: text/javascript` (never `text/html`)

---

## 2. Clean-browser smoke test (server is healthy)

- [ ] Open `https://tng-systems.web.app/funroof` in a **fresh/incognito** browser.
- [ ] Menu renders; no fatal errors in the console (DevTools → Console).
- [ ] Network tab: `index.html` = 200, every `/assets/*.js|css` = 200 (no 404s), no chunk served as `text/html`.
- [ ] Open a real QR table route `https://tng-systems.web.app/funroof/<tableId>` — loads the table's menu.

## 3. Mobile viewport

- [ ] DevTools device toolbar (or a real phone): `/funroof` is usable on a narrow screen.

## 4. Stale-client test (this is what bit us in the demo)

- [ ] On a phone that opened the app **before** the deploy, reopen the QR link.
- [ ] It should either load normally or **auto-reload once** and then load — it must NOT show
      a raw error/stack or a `VITE_*` config screen. If it shows the clean
      “The app was updated — Reload” card, tapping Reload fixes it.

## 5. Error-screen guarantee (no internals ever)

The app is hardened so customers/staff never see internals:
- `src/App.tsx` ErrorBoundary + the config-missing screen render a clean message + Reload; raw
  stack/`error.toString()`/`VITE_*` details are **DEV-only** (`import.meta.env.DEV`).
- `src/main.tsx` + `src/shared/utils/staleDeploy.ts` auto-reload **once per session** on
  `vite:preloadError` / ChunkLoadError / module-MIME failures (guarded — no reload loop).

- [ ] (If reproducing) A forced chunk error shows the clean card, not a stack trace.

## 6. Go/No-Go before a live demo

- [ ] Steps 1–4 pass on both a clean browser and (if possible) a previously-used phone.
- [ ] No fatal console errors on `/funroof`.
- [ ] Keep a known-good previous hosting release handy to roll back:
      Firebase Console → Hosting → (site `tng-systems`) → Release history → **Rollback**.
