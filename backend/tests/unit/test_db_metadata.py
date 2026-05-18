from __future__ import annotations

from app.infrastructure.db.base import Base


def test_inventory_customer_tables_are_registered_in_metadata() -> None:
    assert {
        "products",
        "product_prices",
        "inventory_balances",
        "customers",
        "debt_payments",
        "customer_balance_ledgers",
        "document_counters",
        "invoices",
        "invoice_items",
        "return_invoices",
        "return_invoice_items",
        "users",
        "refresh_tokens",
    }.issubset(Base.metadata.tables)


def test_inventory_balance_requires_exactly_one_quantity_column() -> None:
    table = Base.metadata.tables["inventory_balances"]
    constraint_names = {constraint.name for constraint in table.constraints}

    assert "ck_inventory_balances_exactly_one_quantity" in constraint_names


def test_customer_ledger_indexes_are_registered() -> None:
    table = Base.metadata.tables["customer_balance_ledgers"]
    index_names = {index.name for index in table.indexes}

    assert "ix_customer_balance_ledgers_customer_timeline" in index_names
    assert "ix_customer_balance_ledgers_customer_ref" in index_names
    assert "ix_customer_balance_ledgers_customer_event" in index_names
    assert "ix_customer_balance_ledgers_customer_source" in index_names


def test_debt_payment_constraints_and_indexes_are_registered() -> None:
    table = Base.metadata.tables["debt_payments"]
    constraint_names = {constraint.name for constraint in table.constraints}
    index_names = {index.name for index in table.indexes}

    assert "ck_debt_payments_amount_positive" in constraint_names
    assert "ix_debt_payments_customer_timeline" in index_names
    assert "ix_debt_payments_customer_deleted" in index_names


def test_document_counter_constraints_are_registered() -> None:
    table = Base.metadata.tables["document_counters"]
    constraint_names = {constraint.name for constraint in table.constraints}

    assert "uq_document_counters_type_business_date" in constraint_names
    assert "ck_document_counters_document_type_not_blank" in constraint_names
    assert "ck_document_counters_last_number_non_negative" in constraint_names


def test_sales_schema_constraints_and_indexes_are_registered() -> None:
    invoice_table = Base.metadata.tables["invoices"]
    invoice_constraint_names = {constraint.name for constraint in invoice_table.constraints}
    invoice_index_names = {index.name for index in invoice_table.indexes}

    assert "uq_invoices_invoice_code" in invoice_constraint_names
    assert "ck_invoices_total_amount_non_negative" in invoice_constraint_names
    assert "ck_invoices_paid_amount_non_negative" in invoice_constraint_names
    assert "ix_invoices_invoice_datetime_id" in invoice_index_names
    assert "ix_invoices_customer_datetime_id" in invoice_index_names
    assert "ix_invoices_status_datetime" in invoice_index_names

    item_table = Base.metadata.tables["invoice_items"]
    item_constraint_names = {constraint.name for constraint in item_table.constraints}
    item_index_names = {index.name for index in item_table.indexes}

    assert "ck_invoice_items_quantity_positive" in item_constraint_names
    assert "ck_invoice_items_unit_price_non_negative" in item_constraint_names
    assert "ck_invoice_items_line_total_non_negative" in item_constraint_names
    assert "ix_invoice_items_invoice_id_id" in item_index_names
    assert "ix_invoice_items_product_invoice" in item_index_names


def test_returns_schema_constraints_and_indexes_are_registered() -> None:
    return_table = Base.metadata.tables["return_invoices"]
    return_constraint_names = {constraint.name for constraint in return_table.constraints}
    return_index_names = {index.name for index in return_table.indexes}

    assert "uq_return_invoices_return_code" in return_constraint_names
    assert "ck_return_invoices_total_amount_non_negative" in return_constraint_names
    assert "ix_return_invoices_return_datetime_id" in return_index_names
    assert "ix_return_invoices_customer_datetime_id" in return_index_names
    assert "ix_return_invoices_source_invoice_datetime_id" in return_index_names

    item_table = Base.metadata.tables["return_invoice_items"]
    item_constraint_names = {constraint.name for constraint in item_table.constraints}
    item_index_names = {index.name for index in item_table.indexes}

    assert "ck_return_invoice_items_quantity_positive" in item_constraint_names
    assert "ck_return_invoice_items_unit_price_non_negative" in item_constraint_names
    assert "ck_return_invoice_items_line_total_non_negative" in item_constraint_names
    assert "ix_return_invoice_items_return_invoice_id_id" in item_index_names
    assert "ix_return_invoice_items_source_invoice_item_return" in item_index_names
    assert "ix_return_invoice_items_product_return" in item_index_names


def test_auth_schema_constraints_and_indexes_are_registered() -> None:
    users_table = Base.metadata.tables["users"]
    user_constraint_names = {constraint.name for constraint in users_table.constraints}
    user_index_names = {index.name for index in users_table.indexes}

    assert "ck_users_username_not_blank" in user_constraint_names
    assert "ck_users_display_name_not_blank" in user_constraint_names
    assert "ck_users_password_hash_not_blank" in user_constraint_names
    assert "ck_users_role_known" in user_constraint_names
    assert "ix_users_username" in user_index_names
    assert "ix_users_email_unique_not_null" in user_index_names
    assert "ix_users_role_is_active" in user_index_names
    assert "ix_users_is_active" in user_index_names

    refresh_table = Base.metadata.tables["refresh_tokens"]
    refresh_constraint_names = {constraint.name for constraint in refresh_table.constraints}
    refresh_index_names = {index.name for index in refresh_table.indexes}

    assert "ck_refresh_tokens_token_hash_not_blank" in refresh_constraint_names
    assert "ix_refresh_tokens_token_hash" in refresh_index_names
    assert "ix_refresh_tokens_expires_at" in refresh_index_names
    assert "ix_refresh_tokens_user_revoked" in refresh_index_names
