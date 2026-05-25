import { Navigate, useParams } from "react-router-dom";

export function ProductEditPage() {
  const { productId } = useParams();
  const parsedProductId = Number(productId);

  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
    return <p className="state-message error-message">Ma hang hoa khong hop le.</p>;
  }

  return <Navigate to={`/inventory/products/${parsedProductId}`} replace />;
}
