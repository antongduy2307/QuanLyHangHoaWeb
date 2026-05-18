"""Create inventory and customer core schema.

Revision ID: 20260515_0001
Revises:
Create Date: 2026-05-15
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260515_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("product_code_base", sa.String(length=64), nullable=False),
        sa.Column("product_name", sa.String(length=255), nullable=False),
        sa.Column("unit_mode", sa.String(length=16), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(trim(product_code_base)) > 0", name="ck_products_code_not_blank"),
        sa.CheckConstraint("length(trim(product_name)) > 0", name="ck_products_name_not_blank"),
        sa.CheckConstraint("unit_mode IN ('BAO_KG', 'BICH')", name="ck_products_unit_mode_valid"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_products_product_code_base", "products", ["product_code_base"], unique=True)
    op.create_index("ix_products_product_name", "products", ["product_name"], unique=False)
    op.create_index("ix_products_is_active", "products", ["is_active"], unique=False)

    op.create_table(
        "customers",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("customer_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("current_balance", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("total_sales", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("is_walk_in", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(trim(customer_name)) > 0", name="ck_customers_name_not_blank"),
        sa.CheckConstraint("total_sales >= 0", name="ck_customers_total_sales_non_negative"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_customers_customer_name", "customers", ["customer_name"], unique=False)
    op.create_index("ix_customers_phone", "customers", ["phone"], unique=False)
    op.create_index("ix_customers_is_active", "customers", ["is_active"], unique=False)

    op.create_table(
        "product_prices",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("unit_type", sa.String(length=16), nullable=False),
        sa.Column("price", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.CheckConstraint("unit_type IN ('BAO', 'KG', 'BICH')", name="ck_product_prices_unit_type_valid"),
        sa.CheckConstraint("price >= 0", name="ck_product_prices_price_non_negative"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "unit_type", name="uq_product_prices_product_unit_type"),
    )
    op.create_index(op.f("ix_product_prices_product_id"), "product_prices", ["product_id"], unique=False)

    op.create_table(
        "inventory_balances",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("on_hand_bao_decimal", sa.Numeric(14, 3), nullable=True),
        sa.Column("on_hand_bich_integer", sa.Numeric(14, 3), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "(on_hand_bao_decimal IS NOT NULL AND on_hand_bich_integer IS NULL) "
            "OR (on_hand_bao_decimal IS NULL AND on_hand_bich_integer IS NOT NULL)",
            name="ck_inventory_balances_exactly_one_quantity",
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id"),
    )

    op.create_table(
        "customer_balance_ledgers",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("ref_type", sa.String(length=50), nullable=False),
        sa.Column("ref_id", sa.BigInteger(), nullable=False),
        sa.Column("source_ref_type", sa.String(length=50), nullable=True),
        sa.Column("source_ref_id", sa.BigInteger(), nullable=True),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("amount_delta", sa.Numeric(14, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(14, 2), nullable=False),
        sa.Column("transaction_datetime", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "length(trim(event_type)) > 0",
            name="ck_customer_balance_ledgers_event_type_not_blank",
        ),
        sa.CheckConstraint("length(trim(ref_type)) > 0", name="ck_customer_balance_ledgers_ref_type_not_blank"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_customer_balance_ledgers_customer_timeline",
        "customer_balance_ledgers",
        ["customer_id", "transaction_datetime", "display_order", "id"],
        unique=False,
    )
    op.create_index(
        "ix_customer_balance_ledgers_customer_ref",
        "customer_balance_ledgers",
        ["customer_id", "ref_type", "ref_id"],
        unique=False,
    )
    op.create_index(
        "ix_customer_balance_ledgers_customer_event",
        "customer_balance_ledgers",
        ["customer_id", "event_type"],
        unique=False,
    )
    op.create_index(
        "ix_customer_balance_ledgers_customer_source",
        "customer_balance_ledgers",
        ["customer_id", "source_ref_type", "source_ref_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_balance_ledgers_customer_id"),
        "customer_balance_ledgers",
        ["customer_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_customer_balance_ledgers_customer_id"), table_name="customer_balance_ledgers")
    op.drop_index("ix_customer_balance_ledgers_customer_source", table_name="customer_balance_ledgers")
    op.drop_index("ix_customer_balance_ledgers_customer_event", table_name="customer_balance_ledgers")
    op.drop_index("ix_customer_balance_ledgers_customer_ref", table_name="customer_balance_ledgers")
    op.drop_index("ix_customer_balance_ledgers_customer_timeline", table_name="customer_balance_ledgers")
    op.drop_table("customer_balance_ledgers")
    op.drop_table("inventory_balances")
    op.drop_index(op.f("ix_product_prices_product_id"), table_name="product_prices")
    op.drop_table("product_prices")
    op.drop_index("ix_customers_is_active", table_name="customers")
    op.drop_index("ix_customers_phone", table_name="customers")
    op.drop_index("ix_customers_customer_name", table_name="customers")
    op.drop_table("customers")
    op.drop_index("ix_products_is_active", table_name="products")
    op.drop_index("ix_products_product_name", table_name="products")
    op.drop_index("ix_products_product_code_base", table_name="products")
    op.drop_table("products")
