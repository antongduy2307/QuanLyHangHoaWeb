# Import Runbook Batch Implementation

## Summary

Created an operator runbook for safely repeating the Phase 2 + Phase 3 disposable PostgreSQL import rehearsal and for planning a future production cutover.

The runbook is documentation only. No import was executed, no database was mutated, and no production cutover action was taken.

## Files Created

- `docs/IMPORT_REHEARSAL_AND_CUTOVER_RUNBOOK.md`
- `docs/IMPORT_RUNBOOK_BATCH_IMPLEMENTATION.md`

## Runbook Contents

The runbook covers:

- purpose and scope;
- strict safety rules;
- prerequisites and environment variables;
- Docker/PostgreSQL port `5433` convention;
- step-by-step disposable rehearsal commands;
- expected counts from the current copied real `app.db`;
- required JSON audit artifacts;
- failure handling;
- high-level production cutover draft plan;
- rollback policy draft;
- open production gaps;
- useful PostgreSQL/Docker troubleshooting appendices.

## Verification

Documentation files were created under `QuanLyHangHoaWeb/QuanLyHangHoaWeb/docs/`.

No tests were run because this batch changed documentation only and did not modify backend code.

## Safety Confirmation

- No database command was run.
- No source SQLite database was read or modified.
- No files under `QuanLyHangHoaWeb/QuanLyHangHoa/` were modified.

## Caveats and Next Steps

- Production cutover remains unapproved.
- Attendance, orders, reporting, auth, frontend, deployment, backup/restore, and final acceptance testing remain open before production migration.
- The next operational step is to repeat the runbook against a fresh copy of the latest production `app.db` in a disposable PostgreSQL database and archive the resulting JSON reports.
