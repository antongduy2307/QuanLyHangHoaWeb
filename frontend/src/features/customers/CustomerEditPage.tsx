import { useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { useCustomer } from "./customerQueries";

export function CustomerEditPage() {
  const { customerId } = useParams();
  const parsedCustomerId = Number(customerId);
  const navigate = useNavigate();
  const customerQuery = useCustomer(parsedCustomerId);
  const errorMessage = isApiError(customerQuery.error) ? customerQuery.error.message : "Không thể tải khách hàng.";

  if (!Number.isInteger(parsedCustomerId) || parsedCustomerId <= 0) {
    return <p className="state-message error-message">Mã khách hàng không hợp lệ.</p>;
  }

  if (customerQuery.isLoading) {
    return <p className="state-message">Đang tải khách hàng...</p>;
  }

  if (customerQuery.isError) {
    return <p className="state-message error-message">{errorMessage}</p>;
  }

  if (!customerQuery.data) {
    return null;
  }

  return (
    <InventoryModuleShell title="Sửa khách hàng" description="Cập nhật thông tin và công nợ mục tiêu." compactHero hideHero>
      <CustomerFormDialog customer={customerQuery.data} onClose={() => navigate(`/customers/${parsedCustomerId}`)} />
    </InventoryModuleShell>
  );
}
