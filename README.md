# PBHA Alumni Directory

An alumni directory for the [Phillips Brooks House Association](https://www.pbha.org),
built on the same shape as the FOP Alumni Network: an Express + Prisma API and a
single-file React front end served from the same origin.

This first cut is the directory only. Events, messages, mentorship requests, news,
and donations are deliberately not modeled.

## What it does

- **Sign in / join.** Email and password, JWT in an httpOnly session cookie.
  Signing in somewhere new invalidates the older session.
- **Directory.** Search across name, city, employer, field, and program. Filter by
  scope (everyone / alumni / current students), class-year range, PBHA role,
  program, field of work, and whether someone is open to mentoring. Sort by
  recently joined, class year, or last name. Grid and list layouts.
- **Profiles.** Full profile page with programs, PBHA role, work, and what the
  person is happy to be contacted about.
- **Your profile.** Self-service editing, plus the two privacy switches that decide
  whether a profile is listed and whether other members can open it.

## Design

Type, color, and control shapes follow pbha.org: Work Sans throughout, black on
white, a single orange accent (`#f98715`), and fully-rounded uppercase buttons.

## Running it locally

Requires Node 20+ and Postgres.

```bash
cp .env.example .env      # then set DATABASE_URL, DIRECT_URL, and JWT_SECRET
npm install
npx prisma migrate dev
npm run seed              # 24 invented demo profiles, password: pbha-demo-2026
npm run dev               # http://localhost:4000
```

`npm run seed` upserts by email. Never run it against a database holding real
member data.

## Deploying

Built for a Render web service against a managed Postgres, the way the FOP site is
deployed.

- Build command: `npm install && npm run build`
- Start command: `npm start` (runs `prisma migrate deploy` first)
- Required env: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `PUBLIC_URL`,
  `CORS_ORIGINS`, `NODE_ENV=production`
- Optional: `SIGNUP_SECRET_CODE` to gate signup behind an invite code

## Layout

```
prisma/schema.prisma        User, Profile, PrivacySettings
src/routes/                 auth, directory, users
src/services/               the query and privacy logic
src/lib/class-year.ts       student vs alumni, derived from class year
src/lib/programs.ts         the PBHA program and role vocabulary
public/index.html           the whole front end
```

## Notes for whoever picks this up next

- **Student vs alumni is derived, never stored.** `studentBoundaryYear()` rolls on
  June 1, so nobody has to flip a flag each commencement.
- **The directory's privacy clause lives in `where.OR`.** Any new filter must be
  AND-ed onto `where.AND`; assigning to `where.OR` would drop the privacy check and
  leak private profiles to anyone who passes a query string.
- **Programs are plain strings, not an enum.** PBHA runs 80+ programs and the roster
  changes yearly, so adding one to `src/lib/programs.ts` is a content change rather
  than a migration.
- **Unclaimed profiles** (`claimedAt: null`) model a bulk import. They show name and
  class year only, and signing up with that email claims the row instead of being
  rejected as a duplicate.
- **The directory fetches everything in one request.** There is no load-more UI, so
  raise the frontend page size and the server's `maxPageSize` together once the
  roster approaches 2,000.
