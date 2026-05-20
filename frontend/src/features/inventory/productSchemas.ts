import type { Product, ProductCreatePayload, ProductPrice, ProductUpdatePayload, UnitMode, UnitType } from "../../api/types";

export type ProductFormState = {
  product_code_base: string;
  product_name: string;
  unit_mode: UnitMode;
  prices: Record<UnitType, { is_enabled: boolean; price: string }>;
};

export type ProductFormErrors = Partial<Record<"product_code_base" | "product_name" | "prices", string>>;

const positiveDecimalPattern = /^(?:[1-9]\d*|0)(?:\.\d{1,2})?$/;

export const initialProductFormState: ProductFormState = {
  product_code_base: "",
  product_name: "",
  unit_mode: "BAO_KG",
  prices: {
    BAO: { is_enabled: true, price: "" },
    KG: { is_enabled: false, price: "" },
    BICH: { is_enabled: false, price: "" },
  },
};

function isPositivePrice(value: string) {
  const normalizedValue = value.trim();
  if (!positiveDecimalPattern.test(normalizedValue)) {
    return false;
  }
  return !/^0(?:\.0{1,2})?$/.test(normalizedValue);
}

function enabledPricesForMode(state: ProductFormState): ProductPrice[] {
  if (state.unit_mode === "BICH") {
    return [
      {
        unit_type: "BICH",
        price: state.prices.BICH.price.trim(),
        is_enabled: true,
      },
    ];
  }

  return (["BAO", "KG"] as const).map((unitType) => ({
    unit_type: unitType,
    price: state.prices[unitType].is_enabled ? state.prices[unitType].price.trim() : "0",
    is_enabled: state.prices[unitType].is_enabled,
  }));
}

export function validateProductForm(state: ProductFormState): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!state.product_code_base.trim()) {
    errors.product_code_base = "Ma hang hoa la bat buoc.";
  }
  if (!state.product_name.trim()) {
    errors.product_name = "Ten hang hoa la bat buoc.";
  }

  if (state.unit_mode === "BICH") {
    if (!isPositivePrice(state.prices.BICH.price)) {
      errors.prices = "Gia BICH phai lon hon 0.";
    }
    return errors;
  }

  const enabledBaoKg = (["BAO", "KG"] as const).filter((unitType) => state.prices[unitType].is_enabled);
  if (enabledBaoKg.length === 0) {
    errors.prices = "Can bat it nhat mot gia BAO hoac KG.";
    return errors;
  }
  const invalidPrice = enabledBaoKg.some((unitType) => !isPositivePrice(state.prices[unitType].price));
  if (invalidPrice) {
    errors.prices = "Gia dang bat phai lon hon 0.";
  }
  return errors;
}

export function toProductCreatePayload(state: ProductFormState): ProductCreatePayload {
  return {
    product_code_base: state.product_code_base.trim(),
    product_name: state.product_name.trim(),
    unit_mode: state.unit_mode,
    prices: enabledPricesForMode(state),
  };
}

export function productToFormState(product: Product): ProductFormState {
  const prices: ProductFormState["prices"] = {
    BAO: { is_enabled: false, price: "" },
    KG: { is_enabled: false, price: "" },
    BICH: { is_enabled: false, price: "" },
  };
  for (const price of product.prices) {
    prices[price.unit_type] = {
      is_enabled: price.is_enabled,
      price: price.price,
    };
  }

  return {
    product_code_base: product.product_code_base,
    product_name: product.product_name,
    unit_mode: product.unit_mode,
    prices,
  };
}

export function toProductUpdatePayload(state: ProductFormState): ProductUpdatePayload {
  return {
    product_name: state.product_name.trim(),
    prices: enabledPricesForMode(state),
  };
}
