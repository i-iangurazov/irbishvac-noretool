# Dashboard employee portraits

CSR, Memberships, and Kitchen prefer reviewed portraits served by `/api/staff/portraits/[key]`. The route enforces the existing dashboard identity policy and uses private caching. Image bytes and employee aliases live in `StaffPortrait`, outside the public source repository. Kitchen resolves by Rippling worker ID; the other dashboards use explicit normalized name aliases. Missing portraits fall back to the existing image source and then initials.

The full square banner must remain visible: prepared portraits use `object-fit: contain` with a small inset inside a square frame. Do not apply the legacy face crop or circular clipping to these assets.

To import a private prepared library, first run `node scripts/staff/import-portraits.mjs --manifest=/private/library/prepared-manifest.json`. The manifest must mark reviewed assets as `recommendedForUse: true`. Only validated 512 px WebP files are imported. To apply, provide the existing production `DATABASE_URL` through the process environment and add `--apply --backup=/private/path/previous-portraits.json`. The importer creates the additive table if necessary, backs up affected records, and atomically upserts and verifies all image bytes. Never commit the library, backup, or credentials. A hard reload loads the new portraits immediately; successful images otherwise revalidate within five minutes.

The web production build regenerates the Prisma client before compiling. The portrait route stays behind authentication even when an image is cached or requested by a shared TV account.
