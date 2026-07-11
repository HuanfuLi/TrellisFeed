# Phase 1: User Setup Required

**Generated:** 2026-07-11
**Phase:** 01-rebrand-research-shell-hardening
**Status:** Incomplete

The local Worker, D1 migration, protected researcher page, and ZIP export are implemented and tested. The following items require the study operator's Cloudflare account and must remain outside the repository.

## Environment Variables

| Status | Variable | Source | Add to |
|---|---|---|---|
| [ ] | `RESEARCH_ADMIN_PASSWORD` | Operator-chosen management password supplied with `npx wrangler secret put RESEARCH_ADMIN_PASSWORD` | Cloudflare Worker secret only; never the app or repository |
| [ ] | `VITE_RESEARCH_API_BASE_URL` | Fixed deployed Worker URL | Research app build environment only; never commit a real study URL |

## Account Setup

- [ ] **Create or select the Cloudflare account and D1 database for this study**
  - Required because the operator controls the study URL, D1 binding, and data-access account.
  - Do not place the database identifier, account mappings, or resulting URL in Git.

## Deployment Configuration

- [ ] **Bind the selected D1 database as `DB` in the local deployment configuration**
  - Location: `research-backend/wrangler.jsonc` in the operator's private deployment copy.
  - Add the actual database name/ID only outside committed source.

- [ ] **Apply the schema, provision private numeric study accounts, set the server secret, and deploy**
  - Run from `research-backend/` after the private binding is available:

```powershell
npx wrangler d1 migrations apply <D1_DATABASE_NAME> --remote
npx wrangler secret put RESEARCH_ADMIN_PASSWORD
npx wrangler deploy
```

  - Provision the real `study_accounts` rows through the operator's private process. Do not commit account IDs, conditions, topic IDs, passwords, or the study URL.

## Verification

After deployment, verify over the fixed HTTPS Worker URL:

1. `GET /admin` prompts for HTTP Basic credentials and then shows only event count, Q/A count, and last-received time.
2. A valid `POST /v1/ingest` returns `acknowledgedIds`.
3. `GET /admin/export.zip` downloads an archive containing exactly `behavioral-events.csv` and `question-answer-records.csv`.
4. Inject the fixed public URL only at app package build time as `VITE_RESEARCH_API_BASE_URL`; do not commit it.

---

**Once all items complete:** Mark status as "Complete" at top of file.
