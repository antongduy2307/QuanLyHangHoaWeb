## Summary

This batch finishes the missing setup and entry flow between attendance and inventory for CUT work and blow-team `VK`.

- CUT day-entry can now search existing configured attendance cut items and inventory products.
- Selecting an already configured linked item adds it directly to the CUT table.
- Selecting an inventory product without attendance setup opens a small inline configuration step for quota and excess price, then creates or revives the linked attendance item.
- Blow-team day-entry now includes a working `Làm thêm cắt / VK` section that uses configured CUT items and includes `quantity * excess_unit_price` in preview and save payloads.

## Legacy Behavior Checked

Legacy desktop files reviewed:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\blow_work.py`

Confirmed behavior from legacy code:

- CUT day-entry accepts only configured, valid bag types for new work.
- Invalid or excluded CUT items raise a clear validation message rather than silently creating work.
- Blow `VK` is stored separately as extra CUT work.
- Blow `VK` amount is calculated as `quantity * excess_unit_price`.
- Inventory effects are built for both CUT logs and blow `VK` extra-cut logs.

## Backend Behavior

Added attendance-specific product-link support:

- `GET /api/attendance/cut-work-items?search=...`
  - searches configured attendance CUT items by item name, product name, or product code
- `GET /api/attendance/cut-products/search?search=...`
  - searches active inventory products by name or code
  - returns whether each product is already configured for attendance
- `POST /api/attendance/cut-work-items/from-product`
  - creates or revives a linked attendance CUT item for a product
  - requires quota and excess price when the product is not already configured
  - reactivates and clears excluded/legacy flags when explicitly reconfigured

Response data for CUT items and day-entry bag-type options now includes:

- `product_code_base`
- `product_name`

## Frontend Behavior

`/attendance` day-entry now supports:

- CUT search across configured attendance items and inventory products
- direct add for configured CUT items
- inline product configuration when a product exists but attendance setup is missing
- blow `Làm thêm cắt / VK` search and add flow using configured CUT items
- preview totals that include `VK`
- save payloads that include `extra_cut_work`

## Tests Run / Results

- `uv run pytest`
  - passed
- `npm.cmd test -- --run`
  - passed
- `npm.cmd run build`
  - passed
- `npm.cmd run lint`
  - passed
- `python -m compileall app tests`
  - attempted
  - Python source compiled, but writing some `tests/.../__pycache__/*.pyc` files still hit the existing workspace permission issue

## Deferred / Risks

- CUT setup still uses a compact inline config step, not a full admin settings screen.
- Existing attendance UI/report files outside this task still need a broader cleanup pass if the team wants all attendance strings normalized together.
- Production import/cutover remains separate from this UI/setup batch.
