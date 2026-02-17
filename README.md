# QR Bell Frontend

Next.js PWA for QR Bell owner and visitor experiences.

## Commands
- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm typecheck`

## Deploy
### Platform
- Frontend: Vercel

### Build
- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm build`

### Production Env Vars (required)
- `NEXT_PUBLIC_APP_URL` (your Vercel frontend origin, e.g. `https://<app>.vercel.app`)
- `NEXT_PUBLIC_API_URL` (your Railway backend origin, e.g. `https://<service>.railway.app`)
- `NEXT_PUBLIC_WS_URL` (usually same as API, `wss://...` if you later enable websockets)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (must match backend `VAPID_PUBLIC_KEY`)

## Environment
Use `.env.develop` for local development.

Templates committed:
- `.env.example`
- `.env.develop.example`
