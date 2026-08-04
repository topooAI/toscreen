# ToScreen Share production lifecycle acceptance

This explicit production acceptance tool supports audit item #66. It is not part of the normal machine gate and never mutates production by default.

## Dry-run

Run `npm run acceptance:share-production-lifecycle`. The default command performs no network requests and only prints the structured acceptance plan and mutation gate. Add `-- --probe` to explicitly run read-only production health and viewer-shell checks. Optional dedicated `TOPOO_SHARE_EXISTING_PUBLIC_SLUG` and `TOPOO_SHARE_EXISTING_PRIVATE_SLUG` values add read-only anonymous policy evidence in probe mode. Neither default nor probe mode uploads, comments, changes visibility, or revokes.

## Explicit write acceptance

Writing requires every item below:

- `--write`
- `TOPOO_SHARE_ACCEPT_WRITE=I_UNDERSTAND_THIS_WRITES_TO_PRODUCTION`
- `TOPOO_SHARE_TEST_RESOURCE_ACK=USE_DEDICATED_DISPOSABLE_TEST_RESOURCES`
- Current dedicated test-account bearer tokens in `TOPOO_SHARE_OWNER_TOKEN` and `TOPOO_SHARE_COMMENTER_TOKEN`
- `TOPOO_SHARE_FIXTURE` pointing to a disposable MP4 or GIF

Then run `npm run acceptance:share-production-lifecycle -- --write`.

The JSON evidence records the run ID, checksum, upload checkpoint/finalize, generated slugs, Public and Private policy results, comment lifecycle, revoke cleanup and residual resources. Titles contain the unique run ID. Comments are deleted and shares are revoked in `finally`, including after intermediate failures.

The Worker has no product hard-delete route for sealed uploads or share metadata. A write run therefore retains the sealed disposable fixture and revoked records for traceability. Hard deletion needs a separately authorized administrative retention workflow; this tool never bypasses the product API.

This proves API lifecycle behavior. It does not replace user-observed Chrome login, playback quality, Electron restart recovery, or production retention review.
