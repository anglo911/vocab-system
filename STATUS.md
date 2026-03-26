# STATUS.md

## Current Phase
P5 — deployment setup (Railway + Vercel)

## Current Status
- P0: done
- P1: done
- P2: done
- P3: done
- P3 fix (text + level unique): done
- P4: completed and smoke-tested on Neon
- P5: deployment config added for Railway + Vercel

## P4 Completed
1. ✅ User/Admin role split
   - Added `UserRole` enum (`USER` / `ADMIN`)
   - Added backend `requireAdmin` guard
   - Protected admin routes on backend
   - Added frontend admin-page role check

2. ✅ Import job logs
   - Added `ImportJob` model
   - Tracks created / updated / failed counts
   - Records status and error log
   - Added `/api/admin/import-jobs`
   - Frontend shows import history table

3. ✅ Dashboard chart view
   - Replaced trend list with 7-day bar chart

## Delivery Decision
- Chosen path: **Scheme A / Neon-first**
- Reason: current environment has no local Postgres / Docker support
- Default DB target: managed PostgreSQL (Neon)

## Seed Accounts
- `demo-user` → USER
- `admin-demo` → ADMIN

## P4 Verification Done
1. Real Neon `DATABASE_URL` connected
2. Prisma migrate completed successfully
3. Seed completed successfully
4. Smoke test passed:
   - login as `admin-demo`
   - create word
   - import CSV
   - verify import jobs
   - verify dashboard chart

## Bug Fixes During Verification
- Fixed auth leakage caused by route modules using `app.addHook('preHandler', requireAuth)` on the shared app instance
- Converted affected auth-protected routes to route-level `preHandler` so `/health` and `/api/auth/login` remain public

## P5 Deployment Prep
- Added `railway.json` for backend deployment
- Added `vercel.json` for frontend deployment
- Updated server to read `PORT` and `CORS_ORIGIN` from environment
- Next step: create Railway service + Vercel project and fill production env vars

## Repo Hygiene
- Added `.gitignore` for `dist/`, `.next/`, `.env`, `node_modules/`
- Build artifacts removed from tracked output path for clean source commit
