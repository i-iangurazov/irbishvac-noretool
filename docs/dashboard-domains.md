# Dashboard addresses

Both addresses serve the same authenticated web service:

- https://dashboard.irbishvac.com
- https://irbisweb-production.up.railway.app (independent fallback)

Keep the Railway service domain active. Do not add an unconditional redirect from
it to the custom domain: the fallback must work even when custom DNS is unavailable.

Squarespace manages `irbishvac.com`. The `dashboard` CNAME points to
`2fnaoggu.up.railway.app`; `_railway-verify.dashboard` holds Railway's domain
verification TXT value. Both records use a 30-minute TTL. Other domain records
are unchanged. Railway manages the HTTPS certificate.

The web service keeps `DASHBOARD_PUBLIC_URL=https://irbisweb-production.up.railway.app`
and adds `DASHBOARD_ADDITIONAL_PUBLIC_ORIGINS=https://dashboard.irbishvac.com`.
Login and access-denied returns preserve the opened, explicitly approved host.
Unapproved forwarded hosts fall back to the configured public URL; they never
become redirect destinations. No dashboard permissions are changed.
