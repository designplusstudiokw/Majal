# Majal (مجال)

Civic platform for public-realm interventions. This is the MVP so far: **report a place** (pin, problem, details, photos), a moderator **approves** it, then residents **sign** with a one-time code sent to their mobile.

## Run

```bash
npm install
npm run dev        # http://localhost:3000  (Arabic by default, /en for English)
```

Reports are stored locally in `.data/` (JSON file + `uploads/`). Delete the folder to reset.
`npm run seed` fills it with sample projects around Salmiya so the explorer has something to show.

## Place search (report map)

The search box above the report map finds areas, streets and landmarks in Kuwait through `/api/geocode` (server-side, cached, spaced ≥1 s apart, restricted to Kuwait). Coordinates (`29.33, 48.07`, Arabic digits too) and pasted map links with `@lat,lng` jump straight there without a network call. Set `GEOCODER_USER_AGENT` before using the public Nominatim service; see `.env.example`.

## Link previews

Sharing a project link (including the plaque short link `/p/P-0001`) shows a card with the title, status and signature progress in WhatsApp, iMessage, X, Telegram and others. Pages without their own card use a general one with the headline.

- Cards: `src/app/[lang]/opengraph-image.tsx` and `src/app/[lang]/p/[code]/opengraph-image.tsx`; page text and tags in each page's `generateMetadata`.
- Arabic text is shaped with HarfBuzz (`src/lib/og-text.ts`) and drawn as outlines, because next/og's own text layout puts Arabic words in the wrong order with uneven gaps. Fonts: `assets/fonts` (IBM Plex Sans Arabic, SIL Open Font License).
- Reports not yet approved, or rejected, are marked `noindex` so search engines skip them.
- Set `SITE_URL` if the site runs anywhere other than https://ma-jal.com.

## Explorer

`/ar/explore`: public projects on a map and in a list, filtered by status and problem (filters drive both). Markers are real buttons, so they work with a keyboard and screen reader. Pending and rejected reports never appear.

## Signing and admin

- Review queue: `/ar/admin` (dev password `majal-admin`). Approving a report opens it for signatures.
- Signing: Kuwaiti mobile number + 6-digit code. In dev the code is always `123456` and no SMS is sent. One signature per number per project; the target is `SIGNATURE_TARGET` in `src/lib/domain.ts`.
- Phone numbers are stored only as keyed hashes (never in clear text) and are never shown. Signatures are public as a count only.
- A signed cookie keeps a verified person signed in for 90 days, so they can sign other projects without a new code.
- Production needs real secrets and an SMS provider: copy `.env.example`. The app refuses to start signing in production without them (no silent weak defaults).

## Structure

- `src/app/[lang]/…`: pages (Arabic/English, RTL handled in the root layout)
- `src/app/api/reports`: `POST` multipart endpoint (the future mobile app can reuse it)
- `src/lib/domain.ts`: vocabulary (problems, fixes, statuses), validation, Kuwait bounds
- `src/lib/repo/`: storage behind a `Repository` interface. `local.ts` is the dev store; add a Supabase implementation and select it in `index.ts`
- `src/i18n/`: dictionaries (plain strings so they can be passed to client components)
- `src/proxy.ts`: redirects unprefixed links, e.g. plaque short link `/p/P-0001` → `/ar/p/P-0001`

## Notes for whoever continues

- Next.js 16 with Cache Components: read `node_modules/next/dist/docs/` before changing data fetching.
- MapLibre 6 cannot find its worker once bundled, so `scripts/copy-maplibre-worker.mjs` copies it to `public/` (runs on install/dev/build).
- Basemap defaults to OpenStreetMap raster tiles (development only). Set `NEXT_PUBLIC_MAP_STYLE` to a style URL for production. PACI basemap needs written permission first.
- `src/lib/sms/` is the seam for a real SMS provider (Twilio, Vonage, Unifonic…). Only the dev stand-in exists.
- Rate limits are in memory (single server). Move them to a shared store before running more than one instance.
- When moving to Supabase, its phone auth can replace `src/lib/otp.ts` and the session cookie.
- MapLibre's CSS is imported into a cascade layer (`globals.css`); unlayered, it overrides Tailwind and collapses maps to zero height.
- The explorer uses one HTML marker per project. Past a few hundred projects, switch to a clustered GeoJSON layer (needs a style with glyphs for count labels).
- Not built yet: PWA icons, the design-proposal and sponsor stages.
