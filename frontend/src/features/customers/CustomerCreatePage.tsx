import { useNavigate } from "react-router-dom";

import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import { CustomerFormDialog } from "./CustomerFormDialog";

export function CustomerCreatePage() {
  const navigate = useNavigate();

  return (
    <InventoryModuleShell title="Tạo khách hàng" description="Tạo hồ sơ khách hàng và số dư ban đầu nếu có." compactHero hideHero>
      <CustomerFormDialog customer={null} onClose={() => navigate("/customers")} />
    </InventoryModuleShell>
  );
}
