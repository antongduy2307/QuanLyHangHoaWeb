import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { UnitMode, UnitType } from "../../api/types";
import { PageHeader } from "../../components/PageHeader";
import { initialProductFormState, toProductCreatePayload, validateProductForm, type ProductFormState } from "./productSchemas";
import { useCreateProduct } from "./productQueries";

const baoKgUnits: UnitType[] = ["BAO", "KG"];

export function ProductCreatePage() {
  const [formState, setFormState] = useState<ProductFormState>(initialProductFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const createProduct = useCreateProduct();
  const navigate = useNavigate();

  function updateField(field: keyof Pick<ProductFormState, "product_code_base" | "product_name">, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  function updateUnitMode(unitMode: UnitMode) {
    setFormState((current) => ({
      ...current,
      unit_mode: unitMode,
      prices:
        unitMode === "BICH"
          ? {
              BAO: { ...current.prices.BAO, is_enabled: false },
              KG: { ...current.prices.KG, is_enabled: false },
              BICH: { ...current.prices.BICH, is_enabled: true },
            }
          : {
              BAO: { ...current.prices.BAO, is_enabled: true },
              KG: { ...current.prices.KG },
              BICH: { ...current.prices.BICH, is_enabled: false },
            },
    }));
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
      await createProduct.mutateAsync(toProductCreatePayload(formState));
      navigate("/inventory/products");
    } catch (error) {
      setFormError(isApiError(error) ? error.message : "Khong the tao san pham.");
    }
  }

  return (
    <>
      <PageHeader title="Tạo sản phẩm" description="Tao hang hoa moi voi don vi va gia ban ban dau." />
      <form className="form-panel" onSubmit={handleSubmit}>
        <label>
          Ma hang hoa
          <input value={formState.product_code_base} onChange={(event) => updateField("product_code_base", event.target.value)} />
          {fieldErrors.product_code_base ? <span className="field-error">{fieldErrors.product_code_base}</span> : null}
        </label>

        <label>
          Ten hang hoa
          <input value={formState.product_name} onChange={(event) => updateField("product_name", event.target.value)} />
          {fieldErrors.product_name ? <span className="field-error">{fieldErrors.product_name}</span> : null}
        </label>

        <fieldset>
          <legend>Kieu don vi</legend>
          <label className="inline-choice">
            <input
              type="radio"
              name="unit_mode"
              value="BAO_KG"
              checked={formState.unit_mode === "BAO_KG"}
              onChange={() => updateUnitMode("BAO_KG")}
            />
            BAO / KG
          </label>
          <label className="inline-choice">
            <input
              type="radio"
              name="unit_mode"
              value="BICH"
              checked={formState.unit_mode === "BICH"}
              onChange={() => updateUnitMode("BICH")}
            />
            BICH
          </label>
        </fieldset>

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
          <Link className="secondary-link" to="/inventory/products">
            Huy
          </Link>
          <button type="submit" disabled={createProduct.isPending}>
            {createProduct.isPending ? "Dang tao" : "Tạo sản phẩm"}
          </button>
        </div>
      </form>
    </>
  );
}
