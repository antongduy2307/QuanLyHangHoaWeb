# Mojibake Scan Report V2

Date: 2026-05-25
Target file: `frontend/src/features/sales/InvoiceCreatePage.tsx`

## Summary

The first report was incomplete.

This file still contains three different corruption patterns:

- classic UTF-8 mojibake such as `MÃ£ hÃ ng`
- broken combining-accent text such as `traÌ‰`, `KhaÌch`, `chuÌ`
- severe placeholder-like corruption such as `AAaAa...`

This v2 report lists the remaining mojibake I found from the current file state.

## Remaining Mojibake To Fix

| Line | Current meaning / location | Fix to |
| --- | --- | --- |
| 1210 | loading state message | `Đang tải dữ liệu bán hàng...` |
| 1218 | load-error state message | `Không thể tải hàng hóa hoặc khách hàng.` |
| 1302 | disabled sale search input label/placeholder | `Tìm hàng hóa` |
| 1305 | sale product result list aria label | `Kết quả hàng hóa` |
| 1315 | source-invoice result list aria label | `Kết quả hóa đơn nguồn` |
| 1325 | quick-return product result list aria label | `Kết quả hàng trả` |
| 1335 | order product result list aria label | `Kết quả hàng đặt` |
| 1373 | close-tab aria label | `` `Đóng tab ${label}` `` |
| 1376 | close-tab icon text | `×` |
| 1386 | add-tab button aria label | `Thêm tab POS` |
| 1393 | add-tab menu aria label | `Chọn loại tab POS` |
| 1398 | linked-return menu item text | `Trả hàng theo hóa đơn` |
| 1404 | order menu item text | `Đặt hàng` |
| 1415 | sale line grid aria label | `Danh sách hàng hóa` |
| 1418 | empty header fallback aria label | `Xóa dòng` |
| 1424 | column resize aria label | `` `Kéo để đổi độ rộng cột ${label || "Xóa dòng"}` `` |
| 1444 | delete sale line aria label | `` `Xóa dòng ${index + 1}` `` |
| 1447 | delete sale line icon text | `×` |
| 1471 | sale quantity input aria label | `` `Số lượng dòng ${index + 1}` `` |
| 1480 | sale price input aria label | `` `Đơn giá dòng ${index + 1}` `` |
| 1496 | empty sale line message | `Chưa có hàng hóa trong hóa đơn.` |
| 1503 | sale note field label | `Ghi chú bán hàng` |
| 1507 | sale note field placeholder | `Ghi chú bán hàng` |
| 1512 | order workspace aria label | `Khu vực đặt hàng POS` |
| 1514 | order context title | `Đặt hàng` |
| 1515 | order context description | `Tìm theo tên hàng, lưu số lượng cần làm mà không tác động tồn kho hay công nợ.` |
| 1517 | order table aria label | `Dòng đặt hàng` |
| 1519 | order table headers | `["Tên hàng", "Đơn vị", "Số lượng", "Xóa"]` |
| 1535 | order unit select aria label | `` `Đơn vị đặt hàng dòng ${index + 1}` `` |
| 1554 | order quantity input aria label | `` `Số lượng đặt hàng dòng ${index + 1}` `` |
| 1567 | order line delete aria label | `` `Xóa dòng đặt hàng ${index + 1}` `` |
| 1575 | order line delete icon text | `×` |
| 1584 | empty order line message | `Chưa có hàng hóa trong đơn đặt hàng.` |
| 1589 | order note label | `Ghi chú đơn đặt hàng` |
| 1593 | order note placeholder | `Ghi chú đơn đặt hàng` |
| 1598 | return workspace aria label | `Khu vực trả hàng POS` |
| 1602 | linked-return context title | `Trả hàng theo hóa đơn` |
| 1606 | linked-return empty-context hint | `Chọn hóa đơn nguồn để tiếp tục dòng trả hàng.` |
| 1638 | linked-return quantity input aria label | `` `Trả lần này dòng ${index + 1}` `` |
| 1663 | quick-return context description | `Tìm hàng theo tên, không áp trần số lượng theo hóa đơn nguồn.` |
| 1683 | quick-return unit select aria label | `` `Đơn vị trả nhanh dòng ${index + 1}` `` |
| 1702 | quick-return quantity input aria label | `` `Số lượng trả nhanh dòng ${index + 1}` `` |
| 1713 | quick-return unit price aria label | `` `Đơn giá trả nhanh dòng ${index + 1}` `` |
| 1729 | quick-return delete aria label | `` `Xóa dòng trả nhanh ${index + 1}` `` |
| 1770 | sales payment panel aria label | `Thanh toán` |
| 1772 | edit banner aria label | `Trạng thái sửa hóa đơn` |
| 1773 | edit banner badge | `Đang sửa hóa đơn` |
| 1774 | edit banner fallback title | `` `Hóa đơn #${activeSaleDraft.invoiceId}` `` |
| 1780 | sale customer label | `Khách hàng` |
| 1782 | sale customer input aria label | `Tìm khách hàng` |
| 1783 | sale customer input placeholder | `Tìm khách hàng` |
| 1789 | sale customer result list aria label | `Kết quả khách hàng` |
| 1793 | missing phone fallback | `Không có SĐT` |
| 1804 | missing phone fallback | `Không có SĐT` |
| 1807 | clear selected sale customer button | `Bỏ chọn` |
| 1809 | sale customer balance label | `Công nợ hiện tại` |
| 1812 | walk-in sale label | `Khách lẻ` |
| 1816 | sale datetime label | `Thời gian hóa đơn` |
| 1827 | total label | `Tổng tiền hàng` |
| 1831 | customer-payable label | `Khách cần trả` |
| 1835 | paid amount label | `Khách thanh toán` |
| 1837 | paid amount input aria label | `Khách thanh toán` |
| 1845 | payment delta label | `selectedCustomer ? "Thanh toán thừa / ghi vào công nợ" : "Tiền thừa"` |
| 1860 | edit-submit pending text | `Đang cập nhật` |
| 1861 | edit-submit text | `Cập nhật hóa đơn` |
| 1863 | create-submit pending text | `Đang thanh toán` |
| 1864 | create-submit text | `Thanh toán` |
| 1868 | cancel-edit button | `Hủy sửa` |
| 1872 | invoice list link text | `Xem danh sách hóa đơn` |
| 1878 | order side title | `Đặt hàng` |
| 1881 | order customer label | `Khách hàng` |
| 1883 | order customer input aria label | `Tìm khách đặt hàng` |
| 1884 | order customer input placeholder | `Tìm khách hàng` |
| 1895 | order customer result list aria label | `Kết quả khách đặt hàng` |
| 1899 | missing phone fallback | `Không có SĐT` |
| 1910 | missing phone fallback | `Không có SĐT` |
| 1913 | clear selected order customer button | `Bỏ chọn` |
| 1915 | order customer balance label | `Công nợ hiện tại` |
| 1918 | walk-in order label | `Khách lẻ` |
| 1922 | order datetime label | `Thời gian đặt hàng` |
| 1946 | required-delivery checkbox label | `Có ngày cần giao` |
| 1951 | required-delivery datetime label | `Ngày cần giao` |
| 1971 | order submit text | `createOrder.isPending ? "Đang lưu" : "Lưu đơn đặt hàng"` |
| 1975 | return side panel aria label | `Thông tin trả hàng` |
| 1978 | return side title | `activeReturnDraft.type === "linked_return" ? "Trả hàng theo hóa đơn" : "Trả hàng nhanh"` |
| 1983 | quick-return customer label | `Khách hàng` |
| 1985 | quick-return customer input aria label | `Tìm khách trả hàng` |
| 1986 | quick-return customer input placeholder | `Tìm khách hàng` |
| 1997 | quick-return customer result list aria label | `Kết quả khách trả hàng` |
| 2001 | missing phone fallback | `Không có SĐT` |
| 2012 | linked-return fallback title | `Chưa chọn hóa đơn nguồn` |
| 2013 | linked-return subtitle | `` activeSourceInvoice ? `Hóa đơn ${activeSourceInvoice.invoice_code}` : "Nhập mã hóa đơn nguồn" `` |
| 2020 | missing phone fallback | `Không có SĐT` |
| 2023 | clear selected return customer button | `Bỏ chọn` |
| 2025 | return customer balance label | `Công nợ hiện tại` |
| 2028 | walk-in return label | `Khách lẻ` |
| 2032 | return datetime label | `Thời gian trả hàng` |
| 2046 | handling-mode label | `Cách xử lý` |
| 2056 | handling option | `Hoàn tiền ngay` |
| 2058 | handling option | `Trừ công nợ` |
| 2068 | return total label | `Tổng tiền trả` |
| 2076 | return submit text | `createReturn.isPending ? "Đang trả hàng" : "Trả hàng"` |
| 2079 | returns list link text | `Xem danh sách trả hàng` |

## What V2 Adds Over V1

V1 mostly captured the large obvious literals.

V2 adds the lines that were missed, especially:

- loading and error copy at the top-level shell
- dropdown aria labels for source invoices, return products, order products, and customer searches
- tab-close, add-tab, and tab-menu labels
- sale/order/return workspace labels and empty states
- per-row aria labels for delete, quantity, unit, and unit price controls
- order-tab descriptive copy
- linked-return helper text and invoice subtitle

## Practical Repair Order

If you want to fix this file manually with the least churn, do it in this order:

1. Fix all severe `AAaAa...` literals first.
2. Fix all broken combining-accent strings like `traÌ‰`, `chuÌ`, `KhaÌch`.
3. Fix the remaining classic `MÃ...` UTF-8 mojibake.
4. Re-scan the file again after edits because several aria-labels and placeholders repeat the same phrase in multiple places.
