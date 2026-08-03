# ToScreen Share Worker

This Worker implements `docs/product/Topoo-Account-and-Share-Contract.md`. It validates bearer sessions through Topoo Auth and never receives database credentials in the desktop renderer.

Required bindings:

- D1 database as `DB`, initialized with `schema.sql`.
- Private R2 bucket as `MEDIA`.
- Secret `PLAYBACK_SIGNING_SECRET`.
- `AUTH_SESSION_URL=https://auth.topoo.ai/api/auth/session`.
- `PUBLIC_BASE_URL`, normally `https://share.topoo.ai`.

Deployment:

```sh
cd services/share-worker
wrangler r2 bucket create toscreen-share-media
node scripts/prepare-deploy.mjs
wrangler d1 migrations apply toscreen-share --remote --config wrangler.generated.toml
wrangler secret put PLAYBACK_SIGNING_SECRET
wrangler deploy --config wrangler.generated.toml
```

Configure `VITE_TOPOO_SHARE_URL` for the desktop build. Configure Topoo Auth to allow `toscreen://auth/callback`; the callback contains the short-lived desktop session token, which Electron immediately encrypts with `safeStorage`. No token or API key belongs in source control.
