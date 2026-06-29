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
        "attendance_employees",
        "attendance_periods",
        "attendance_daily_records",
        "attendance_work_types",
        "attendance_bag_types",
        "attendance_work_logs",
        "attendance_cut_logs",
        "attendance_extra_cut_logs",
        "attendance_inventory_effects",
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


def test_attendance_schema_constraints_and_indexes_are_registered() -> None:
    employee_table = Base.metadata.tables["attendance_employees"]
    employee_constraint_names = {constraint.name for constraint in employee_table.constraints}
    employee_index_names = {index.name for index in employee_table.indexes}

    assert "ck_attendance_employees_display_name_not_blank" in employee_constraint_names
    assert "ck_attendance_employees_team_known" in employee_constraint_names
    assert "uq_attendance_employees_display_name" in employee_constraint_names
    assert "uq_attendance_employees_user_id" in employee_constraint_names
    assert "ix_attendance_employees_display_name" in employee_index_names
    assert "ix_attendance_employees_team_is_active" in employee_index_names

    period_table = Base.metadata.tables["attendance_periods"]
    period_constraint_names = {constraint.name for constraint in period_table.constraints}
    period_index_names = {index.name for index in period_table.indexes}

    assert "uq_attendance_periods_start_end" in period_constraint_names
    assert "ck_attendance_periods_date_order" in period_constraint_names
    assert "ix_attendance_periods_start_date" in period_index_names
    assert "ix_attendance_periods_end_date" in period_index_names
    assert "ix_attendance_periods_locked" in period_index_names

    daily_record_table = Base.metadata.tables["attendance_daily_records"]
    daily_constraint_names = {constraint.name for constraint in daily_record_table.constraints}
    daily_index_names = {index.name for index in daily_record_table.indexes}

    assert "uq_attendance_daily_records_employee_work_date" in daily_constraint_names
    assert "ck_attendance_daily_records_status_known" in daily_constraint_names
    assert "ck_attendance_daily_records_total_amount_non_negative" in daily_constraint_names
    assert "ix_attendance_daily_records_work_date" in daily_index_names
    assert "ix_attendance_daily_records_employee_date" in daily_index_names
    assert "ix_attendance_daily_records_period_status" in daily_index_names

    work_type_table = Base.metadata.tables["attendance_work_types"]
    work_type_constraint_names = {constraint.name for constraint in work_type_table.constraints}
    work_type_index_names = {index.name for index in work_type_table.indexes}

    assert "ck_attendance_work_types_team_known" in work_type_constraint_names
    assert "ck_attendance_work_types_team_blow" in work_type_constraint_names
    assert "ck_attendance_work_types_input_type_known" in work_type_constraint_names
    assert "ck_attendance_work_types_pricing_rule_known" in work_type_constraint_names
    assert "uq_attendance_work_types_team_name" in work_type_constraint_names
    assert "ix_attendance_work_types_team_active" in work_type_index_names

    bag_type_table = Base.metadata.tables["attendance_bag_types"]
    bag_type_constraint_names = {constraint.name for constraint in bag_type_table.constraints}
    bag_type_index_names = {index.name for index in bag_type_table.indexes}

    assert "ck_attendance_bag_types_name_not_blank" in bag_type_constraint_names
    assert "ck_attendance_bag_types_quota_non_negative" in bag_type_constraint_names
    assert "ck_attendance_bag_types_excess_price_non_negative" in bag_type_constraint_names
    assert "ck_attendance_bag_types_product_link_consistent" in bag_type_constraint_names
    assert "uq_attendance_bag_types_name" in bag_type_constraint_names
    assert "ix_attendance_bag_types_active" in bag_type_index_names

    work_log_table = Base.metadata.tables["attendance_work_logs"]
    work_log_constraint_names = {constraint.name for constraint in work_log_table.constraints}
    assert "uq_attendance_work_logs_daily_work_type" in work_log_constraint_names
    assert "ck_attendance_work_logs_quantity_non_negative" in work_log_constraint_names

    cut_log_table = Base.metadata.tables["attendance_cut_logs"]
    cut_log_constraint_names = {constraint.name for constraint in cut_log_table.constraints}
    assert "uq_attendance_cut_logs_daily_bag_type" in cut_log_constraint_names
    assert "ck_attendance_cut_logs_quantity_non_negative" in cut_log_constraint_names

    extra_cut_log_table = Base.metadata.tables["attendance_extra_cut_logs"]
    extra_cut_log_constraint_names = {constraint.name for constraint in extra_cut_log_table.constraints}
    assert "uq_attendance_extra_cut_logs_daily_bag_type" in extra_cut_log_constraint_names
    assert "ck_attendance_extra_cut_logs_quantity_positive" in extra_cut_log_constraint_names

    effect_table = Base.metadata.tables["attendance_inventory_effects"]
    effect_constraint_names = {constraint.name for constraint in effect_table.constraints}
    effect_index_names = {index.name for index in effect_table.indexes}

    assert "ck_attendance_inventory_effects_quantity_positive" in effect_constraint_names
    assert "ck_attendance_inventory_effects_unit_type_known" in effect_constraint_names
    assert "ck_attendance_inventory_effects_exactly_one_source" in effect_constraint_names
    assert "uq_attendance_inventory_effects_cut_log_id" in effect_constraint_names
    assert "uq_attendance_inventory_effects_extra_cut_log_id" in effect_constraint_names
    assert "ix_attendance_inventory_effects_daily_record_id" in effect_index_names
    assert "ix_attendance_inventory_effects_product_id" in effect_index_names
