from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.application.inventory_service import InventoryService
from app.domain.enums import UnitMode, UnitType


pytestmark = [pytest.mark.integration, pytest.mark.postgres]


def test_postgres_stock_changes_use_locked_balance_path(postgres_session: Session) -> None:
    service = InventoryService()
    product = service.create_product(
        postgres_session,
        product_code_base="pg-stock",
        product_name="Postgres Stock",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.BAO: "250000"},
    )

    service.increase_stock(postgres_session, product.id, "1", UnitType.BAO)
    service.increase_stock(postgres_session, product.id, "25", UnitType.KG)
    balance = service.decrease_stock(postgres_session, product.id, "12.5", UnitType.KG)

    assert balance.on_hand_bao_decimal == Decimal("1.500")
