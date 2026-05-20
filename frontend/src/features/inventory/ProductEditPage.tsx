import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { Product, UnitType } from "../../api/types";
import { PageHeader } from "../../components/PageHeader";
import {
  productToFormState,
  toProductUpdatePayload,
  validateProductForm,
  type ProductFormState,
} from "./productSchemas";
import { useProduct, useUpdateProduct } from "./productQueries";

const baoKgUnits: UnitType[] = ["BAO", "KG"];

export function ProductEditPage() {
  const { productId } = useParams();
  const parsedProductId = Number(productId);
  const productQuery = useProduct(parsedProductId);
  const errorMessage = isApiError(productQuery.error) ? productQuery.error.message : "Khong the tai hang hoa.";

  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
    return <p className="state-message error-message">Ma hang hoa khong hop le.</p>;
  }

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Sua hang hoa" description="Cap nhat ten hang va gia ban. Ma hang va kieu don vi khong thay doi." />
        <Link className="secondary-link" to={`/inventory/products/${parsedProductId}`}>
          Quay lai
        </Link>
      </div>

      {productQuery.isLoading ? <p className="state-message">Dang tai hang hoa...</p> : null}
      {productQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {productQuery.isSuccess ? <ProductEditForm product={productQuery.data} /> : null}
    </>
  );
}

function ProductEditForm({ product }: { product: Product }) {
  const [formState, setFormState] = useState<ProductFormState>(() => productToFormState(product));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const updateProduct = useUpdateProduct(product.id);
  const navigate = useNavigate();

  function updateName(value: string) {
    setFormState((current) => ({ ...current, product_name: value }));
  }

  function updatePrice(unitType: UnitType, value: string) {
    setFormState((current) => ({
      ...current,
      prices: {
        ...current.prices,
        [unitType]: { ...current.prices[unitType], price: value },
      },
    }));
  }

  function updatePriceEnabled(unitType: UnitType, isEnabled: boolean) {
    setFormState((current) => ({
      ...current,
      prices: {
        ...current.prices,
        [unitType]: { ...current.prices[unitType], is_enabled: isEnabled },
      },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const errors = validateProductForm(formState);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const product = await updateProduct.mutateAsync(toProductUpdatePayload(formState));
      navigate(`/inventory/products/${product.id}`);
    } catch (error) {
      setFormError(isApiError(error) ? error.message : "Khong the cap nhat hang hoa.");
    }
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      <label>
        Ma hang hoa
        <input value={formState.product_code_base} disabled readOnly />
      </label>
      <label>
        Kieu don vi
        <input value={formState.unit_mode} disabled readOnly />
      </label>
      <label>
        Ten hang hoa
        <input value={formState.product_name} onChange={(event) => updateName(event.target.value)} />
        {fieldErrors.product_name ? <span className="field-error">{fieldErrors.product_name}</span> : null}
      </label>

      {formState.unit_mode === "BAO_KG" ? (
        <fieldset>
          <legend>Gia BAO / KG</legend>
          {baoKgUnits.map((unitType) => (
            <div className="price-row" key={unitType}>
              <label className="inline-choice">
                <input
                  type="checkbox"
                  checked={formState.prices[unitType].is_enabled}
                  onChange={(event) => updatePriceEnabled(unitType, event.target.checked)}
                />
                Bat gia {unitType}
              </label>
              <label>
                Gia {unitType}
                <input
                  inputMode="decimal"
                  disabled={!formState.prices[unitType].is_enabled}
                  value={formState.prices[unitType].price}
                  onChange={(event) => updatePrice(unitType, event.target.value)}
                />
              </label>
            </div>
          ))}
        </fieldset>
      ) : (
        <fieldset>
          <legend>Gia BICH</legend>
          <label>
            Gia BICH
            <input
              inputMode="decimal"
              value={formState.prices.BICH.price}
              onChange={(event) => updatePrice("BICH", event.target.value)}
            />
          </label>
        </fieldset>
      )}
      {fieldErrors.prices ? <p className="field-error">{fieldErrors.prices}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="form-actions">
        <Link className="secondary-link" to={`/inventory/products/${product.id}`}>
          Huy
        </Link>
        <button type="submit" disabled={updateProduct.isPending}>
          {updateProduct.isPending ? "Dang luu" : "Luu hang hoa"}
        </button>
      </div>
    </form>
  );
}
