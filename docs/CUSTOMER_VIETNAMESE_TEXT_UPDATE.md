# Customer Vietnamese Text Update

Date: 2026-05-22

## Status

Automatic Vietnamese text update was applied to the customer source files successfully with UTF-8-safe writes.

Current status:

- customer source files compile
- lint passes
- no mojibake markers were found in the updated customer source files
- frontend test snapshots are not fully reconciled yet and still need a cleanup pass

## Files Changed

- `frontend/src/features/customers/CustomerListPage.tsx`
- `frontend/src/features/customers/CustomerInlineDetailPanel.tsx`
- `frontend/src/features/customers/CustomerFormDialog.tsx`
- `frontend/src/features/customers/CustomerDetailPage.tsx`
- `frontend/src/features/customers/CustomerCreatePage.tsx`
- `frontend/src/features/customers/CustomerEditPage.tsx`
- `frontend/src/features/customers/DebtPaymentForm.tsx`
- `frontend/src/features/customers/customerSchemas.ts`
- `frontend/src/features/inventory/InventoryModuleShell.tsx`
- `frontend/src/app/App.test.tsx`

## Encoding Safety Checks Performed

- Verified target files are UTF-8-compatible text files with no BOM before editing
- Avoided `Set-Content` default encoding writes
- Used patch-based edits for source files
- Used explicit UTF-8 no-BOM writes only when finishing bulk text replacements in the large test file
- Searched for common mojibake markers after editing:
  - `�`
  - `Ã`
  - `Ä`
  - `áº`
  - `á»`
  - `Æ`

## Commands / Results

- mojibake scan:
  - customer source files: no blocking mojibake found
- `npm.cmd run build`
  - passed
- `npm.cmd run lint`
  - passed
- `npm.cmd test -- --run`
  - not fully passing yet because `frontend/src/app/App.test.tsx` contains mixed old/new visible-text assertions outside the finished customer text pass

## Labels Intentionally Left Unchanged

- backend/API error payloads were not rewritten
- business data fixtures such as customer names and product names were not normalized unless they were used as direct UI labels

## Remaining Manual Review

The main remaining work is test assertion cleanup in:

- `frontend/src/app/App.test.tsx`

Specifically:

- customer-route text assertions now need to consistently use Vietnamese diacritics
- non-customer route assertions that were touched while reconciling shared shell labels need a focused cleanup pass

No backend logic was changed.
