# ToScreen × Topoo Account and Share Contract

Status: implementation contract for the Screen Studio completion program.

## Product behavior

- ToScreen uses the same Topoo identity as Topoo Cloud. An existing Topoo user must not create a separate ToScreen account.
- The editor top bar shows the signed-in user's avatar and display name at the top right. Its compact pill follows the Topoo sidebar user treatment: avatar or initial, display name, and a menu for account, share history, and sign out.
- A signed-out user can edit and export locally. Sign-in is required only for Quick Share, private links, comments, and account-scoped share history.
- Quick Share uploads the selected export, then creates a public, unlisted, or private link. Private links require an authorized Topoo session.
- The viewer page supports timestamped comments. Owners can resolve or delete comments and can revoke a link without deleting the local project.

## Identity boundary

- The Electron client must never receive database credentials or query the Topoo user database directly.
- Authentication uses `https://auth.topoo.ai/api/auth` and the existing Topoo session contract. The canonical profile fields are `id`, `email`, `displayName`, `nickname`, and `avatarUrl`/`avatar_url`.
- The desktop renderer must not persist a bearer token in plain local storage. The Electron main process stores it with the operating-system protected storage API and exposes narrow sign-in/session/sign-out IPC calls.
- The share service validates every bearer token against `GET /api/auth/session` and stores the returned Topoo user ID as the share owner or comment author.
- Local editing, local export, and opening an existing local project must remain available when Topoo Auth or the share service is offline.

## Share service contract

The share service owns media and sharing metadata; Topoo Auth remains the identity authority.

### Required operations

| Operation | Purpose |
|---|---|
| `POST /v1/uploads` | Create a resumable upload owned by the authenticated Topoo user |
| `PUT /v1/uploads/:id/parts/:part` | Upload a bounded media part |
| `POST /v1/uploads/:id/finalize` | Verify size/checksum and seal the media object |
| `POST /v1/shares` | Create a public, unlisted, or private link from a sealed upload |
| `GET /v1/shares/:slug` | Read viewer metadata and an authorized playback URL |
| `PATCH /v1/shares/:slug` | Rename, change visibility, or revoke a link |
| `GET /v1/shares` | List the signed-in user's share history |
| `GET /v1/shares/:slug/comments` | List timestamped comments visible to the viewer |
| `POST /v1/shares/:slug/comments` | Add a timestamped comment as a Topoo user |
| `PATCH /v1/shares/:slug/comments/:id` | Resolve a comment as the owner |
| `DELETE /v1/shares/:slug/comments/:id` | Delete a comment as its author or the share owner |

### Durable entities

- `uploads`: owner, state, byte size, checksum, content type, storage key, created/expiry time.
- `shares`: owner, upload, title, slug, visibility, revocation state, created/updated time.
- `share_members`: private-link user grants and role.
- `share_comments`: author, timestamp in milliseconds, body, resolved state, created/updated time.

Uploaded media is private by default. Viewer playback uses short-lived signed URLs. A revoked or unauthorized share must not expose the storage key or media bytes.

## Completion evidence

This capability is `Completed` only when all of the following are verified:

1. The same Topoo credentials/session return the same user ID and avatar in ToScreen.
2. The top-right user pill renders signed-in, signed-out, loading, expired-session, and offline states.
3. A real exported video uploads, resumes after interruption, finalizes, and plays from a share link.
4. Public, unlisted, private, and revoked access policies are exercised against the deployed service.
5. Timestamped comments round-trip with the correct Topoo author and permissions.
6. Restarting Electron restores the protected session without exposing the token to the renderer.
7. Local editing and export continue to work while both remote services are unavailable.
