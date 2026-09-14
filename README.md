# PBHA Alumni Directory

An alumni directory for the [Phillips Brooks House Association](https://www.pbha.org),
built on the same shape as the FOP Alumni Network: an Express + Prisma API and a
single-file React front end served from the same origin.

It is the Alumni section of pbha.org: a sign-in page, then Welcome, Directory,
Alumni Study, and Archives. Messages, events, and donations are deliberately not
modeled — PBHA already runs giving, and this exists to fill the gap those
channels leave.

## What it does

- **Sign in / join.** A centred landing page, then email and password, with the
  JWT in an httpOnly session cookie. Signing in somewhere new invalidates the
  older session.
- **Welcome.** What a member can do here, then PBHA's own involvement channels.
- **Alumni Study.** PBHA's alumni survey (n=1,078), reported as PBHA published it:
  both the all-respondent and intensive-programming figures where two exist, with
  the researchers credited and the missing methodology noted.
- **Messages.** One-to-one, between signed-in members, opened from a profile.
  A thread is keyed on the pair of people in it, so writing to someone twice
  continues the conversation rather than starting a second one beside it.
- **Archives.** PBHA has no archive. This assembles their published decade history
  and the 120 Stories series in one place, and points alumni at the submission form.
- **Directory.** Search across name, city, employer, field, and program. Filter by
  scope (everyone / alumni / current students), a dual-handle class-year range,
  PBHA role, program, field of work, and whether someone is open to mentoring.
  Sort by recently joined, class year, or last name.
- **Grid, list, and map.** The map plots members on a Robinson projection, sized
  by how many are in each place; clicking a place lists them underneath so the
  map keeps its zoom. Ported from the FOP alumni directory, which this is
  modeled on.
- **Profiles.** Name, class year, concentration, House, where they live now, what
  they do now, PBHA role and programs, how they were involved, optional identity,
  and "Students should reach out to me about:".
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

## Integrating with pbha.org

This is built to drop into their site rather than to sit beside it, so it does
not restate their menu or reproduce their pages. What it does carry is their
type, palette, control shapes, and footer, so a visitor crossing from pbha.org
into the directory should not feel a seam.

When PBHA is ready, integration is three things:

1. **One nav item.** Add `Alumni` to their top-level nav, pointed at wherever
   this is hosted — `pbha.org/alumni` via a reverse proxy or subdomain, or an
   external link to start with. Nothing in this app needs to change.
2. **A host and a database.** Any Node host plus Postgres (see Deploying).
3. **The roster.** Load names, class years, and programs as unclaimed rows;
   members claim their own by signing up with the email on the row.

Their header and footer live in `public/index.html` as ordinary markup. If they
would rather serve their real Squarespace chrome around this, the app's own
header and footer come out and the rest is unaffected.

## The static demo

`docs/` is a self-contained demo published to GitHub Pages at
<https://k-12345-1.github.io/pbha-alumni/>. It is the real front end with a mock
in place of the API, so the directory, filters, search, and profile pages work
with no server; sign-in and saving are inert.

```bash
npm run build:demo    # regenerate docs/index.html after a front-end change
```

`public/index.html` stays the single source of truth — the demo is generated from
it, never forked. The preview also carries two notes the real build does not: a
line on the sign-in card saying the directory is not live and any credentials
will do, and a line in the footer saying it is a prototype rather than an
official PBHA service. Both exist because the preview sits on a public URL
wearing PBHA's branding, and both come out once PBHA hosts it themselves. The only demo-awareness in the app is the `window.__demoRequest`
hook at the top of `api.request`, which nothing defines in the real build.

## Layout

```
prisma/schema.prisma        User, Profile, PrivacySettings
src/routes/                 auth, directory, messages, users
src/services/               the query and privacy logic
src/lib/class-year.ts       student vs alumni, derived from class year
src/lib/programs.ts         the PBHA program and role vocabulary
public/geo/                 world outlines + the location lookup the map reads
scripts/geocode-locations.js  resolves typed locations to coordinates
public/index.html           the whole front end
scripts/build-demo.js       generates docs/ for GitHub Pages
docs/                       the published static demo (generated)
```

## The map

`public/geo/world.json` holds the country outlines already projected; the build
that produces it is the one from the FOP directory. `public/geo/locations.json`
maps typed location text ("Brooklyn, NY", "SF", "London, UK") to coordinates and
is committed, so nothing geocodes at request time.

```bash
npm run geocode             # resolve locations that have no entry yet
npm run geocode -- --report # just list what is unresolved
```

A location with no entry simply has no dot; it is never guessed at.

## Notes for whoever picks this up next

- **Student vs alumni is derived, never stored.** `studentBoundaryYear()` rolls on
  June 1, so nobody has to flip a flag each commencement.
- **The directory's privacy clause lives in `where.OR`.** Any new filter must be
  AND-ed onto `where.AND`; assigning to `where.OR` would drop the privacy check and
  leak private profiles to anyone who passes a query string.
- **Programs are plain strings, not an enum.** PBHA runs 80+ programs and the roster
  changes yearly, so adding one to `src/lib/programs.ts` is a content change rather
  than a migration. House is free text for the same reason.
- **Identity is off by default and stripped server-side.** `gender` and
  `raceEthnicity` are only returned when their owner has set
  `PrivacySettings.showIdentity`; `getProfile` blanks them for everyone else, so
  they never reach a client that is not entitled to them, and the directory's card
  select does not read those columns at all.
- **The Study and Archives content is PBHA's, hard-coded in the front end.** Every
  figure and date comes from pbha.org. If they publish new findings, those constants
  at the top of the Study and Archives components are where they change.
- **Unclaimed profiles** (`claimedAt: null`) model a bulk import. They show name and
  class year only, and signing up with that email claims the row instead of being
  rejected as a duplicate.
- **The directory fetches everything in one request.** There is no load-more UI, so
  raise the frontend page size and the server's `maxPageSize` together once the
  roster approaches 2,000.
