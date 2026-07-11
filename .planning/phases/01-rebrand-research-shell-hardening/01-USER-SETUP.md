# Phase 1: User Setup Required

**Generated:** 2026-07-11
**Phase:** 01-rebrand-research-shell-hardening
**Status:** Deployment verified; study operations pending

The Worker and D1 database are deployed, protected, and live-smoke-tested. The fixed URL, database identifier, password, and temporary verification fixture remain outside the repository. Only real study-account provisioning and app-build URL injection remain.

## Environment Variables

| Status | Variable | Source | Add to |
|---|---|---|---|
| [x] | `RESEARCH_ADMIN_PASSWORD` | Operator-chosen management password supplied with `npx wrangler secret put RESEARCH_ADMIN_PASSWORD` | Cloudflare Worker secret only; never the app or repository |
| [ ] | `VITE_RESEARCH_API_BASE_URL` | Fixed deployed Worker URL | Research app build environment only; never commit a real study URL |

## Account Setup

- [x] **Create the Cloudflare D1 database and deploy the study Worker**
  - The live binding, migration, Worker secret, and fixed HTTPS endpoint were verified by the operator.
  - The database identifier and resulting URL remain private and are not recorded here.

- [ ] **Batch-provision the real numeric research accounts**
  - Insert the final `study_accounts` mappings through the operator's private process before participant installation.
  - Keep account IDs, conditions, topic IDs, and assignment materials outside Git. The temporary smoke-test account and event have already been removed.

## Deployment Configuration

- [x] **Bind the selected D1 database as `DB` in the private deployment configuration**
  - The live Worker is using the selected database; its actual name/ID remains outside committed source.

- [x] **Apply migration 0001, set the server secret, and deploy**
  - These authenticated Cloudflare steps have been completed. The commands used were:

```powershell
npx wrangler d1 migrations apply <D1_DATABASE_NAME> --remote
npx wrangler secret put RESEARCH_ADMIN_PASSWORD
npx wrangler deploy
```

  - Do not commit account IDs, conditions, topic IDs, passwords, the database identifier, or the study URL.

## Verification

Live verification over the fixed HTTPS Worker URL is complete:

1. [x] Unauthenticated `GET /admin` and `GET /admin/export.zip` return HTTP 401.
2. [x] Authenticated `GET /admin` shows only event count, Q/A count, and last-received time.
3. [x] `GET /admin/export.zip` downloads an archive containing exactly `behavioral-events.csv` and `question-answer-records.csv`.
4. [x] A temporary numeric account completed install resolution; a valid `app_open` ingest returned an acknowledgement and used the server-owned condition/topic values.
5. [x] The temporary account and test event were removed after verification.

## Remaining App Build Step

- [ ] After the real numeric research accounts have been batch-provisioned, inject the fixed public URL as `VITE_RESEARCH_API_BASE_URL` while producing and verifying the participant app package; do not commit it.

---

**Once both remaining study-operations items are complete:** Mark status as "Complete" at the top of this file.
