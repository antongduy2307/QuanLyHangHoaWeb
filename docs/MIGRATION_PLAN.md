# Migration Plan

## Phase 0: Reference Behavior Freeze

- Treat `../QuanLyHangHoa/` as read-only.
- Use desktop tests, services, models, and documentation as behavioral references.
- Capture important invariants for ledgers, stock effects, returns, invoice edits, and attendance records before porting code.
- Prepare representative exports from `app.db` and `attendance.db` for later migration validation.

## Phase 1: Backend Foundation

- Create FastAPI application skeleton.
- Add typed environment-based settings.
- Add SQLAlchemy 2.x engine/session foundation.
- Add Alembic baseline wiring.
- Add local PostgreSQL docker compose setup.
- Add pytest health check.
- Keep business logic out of this phase.

## Phase 2: Inventory and Customer Core

- Port inventory product, price, balance, receipt, and adjustment rules.
- Port customer and customer balance ledger rules.
- Add PostgreSQL constraints and transaction tests.
- Add import validation for product, balance, customer, and ledger data.

## Phase 3: Sales and Returns

- Port invoice creation, update, delete, payment, and inventory/customer effects.
- Port linked returns and quick returns.
- Preserve rollback and reapply semantics.
- Add tests for overpayment, walk-in customer behavior, store credit, refund-now handling, and customer balance recomputation.

## Phase 4: Attendance Backend

- Port employee, period, daily record, work type, bag type, and attendance report models.
- Port blow and cut work calculations.
- Port product-to-cut-work synchronization.
- Port attendance-to-inventory stock effects into a single PostgreSQL transaction model where possible.

## Phase 5: Admin Web UI

- Build React admin workflows for inventory, customers, sales, returns, orders, reporting, and settings.
- Use the desktop UI as a feature checklist, not as a source for UI code.
- Keep frontend state and API contracts explicit.

## Phase 6: Employee Attendance Portal

- Build attendance-specific web workflows.
- Support day entry, draft/finalize behavior, employee lists, attendance settings, and reports.
- Design for practical use on desktop, tablet, and mobile screens as needed.

## Phase 7: Data Import and Cutover

- Build deterministic import tooling from `app.db` and `attendance.db`.
- Validate row counts, foreign keys, orphan records, customer balances, inventory balances, and stock effects.
- Run parallel acceptance testing against desktop reference data.
- Define cutover, rollback, and archival procedures before production migration.

