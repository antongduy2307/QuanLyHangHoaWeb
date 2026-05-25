# History Batch D Pagination Filters

Date: 2026-05-24

## Summary

Implemented History Batch D to improve `/history` usability and performance.

This batch adds:

- backend-backed pagination
- page size selection
- refined date range controls with quick presets
- polished event type filter chips
- customer filter
- product filter
- preserved detail drawer behavior

No write actions or export were added.

## Backend Changes

Added paginated history response support to `GET /api/history`.

### New query params

- `page`
- `page_size`

### Response shape

- `page`
- `page_size`
- `total`
- `items`

Sorting remains stable and unchanged in intent:

1. `event_datetime` descending
2. `display_order` descending
3. `event_id` descending

## Frontend Changes

### Pagination

- previous/next controls
- page size selector
- result count and current page display

### Filter Refinement

- quick date presets:
  - today
  - last 7 days
  - last 30 days
- event type chips
- customer select filter
- product select filter
- existing keyword search preserved
- clear filters resets page and drawer state

### Drawer Preservation

- drawer behavior was preserved
- row selection still highlights correctly
- pagination/filter changes clear the selected drawer row safely

## Files Changed

- `backend/app/api/routes/history.py`
- `backend/app/application/history_service.py`
- `backend/app/schemas/history.py`
- `backend/tests/api/test_history_api.py`
- `backend/tests/integration/test_history_postgres.py`
- `frontend/src/api/history.ts`
- `frontend/src/api/types.ts`
- `frontend/src/features/history/HistoryListPage.tsx`
- `frontend/src/features/history/HistoryListPage.test.tsx`
- `frontend/src/features/history/historyQueries.ts`
- `frontend/src/styles.css`

## Tests Run / Results

Executed:

- `uv run pytest`
- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results are captured from the final verification run for this batch.

## Known Limitations

- backend pagination currently pages after assembling the unified in-memory event list
- no server-side customer/product search for filter selects yet; the frontend uses existing list APIs
- no export or pagination deep-linking in the URL yet
