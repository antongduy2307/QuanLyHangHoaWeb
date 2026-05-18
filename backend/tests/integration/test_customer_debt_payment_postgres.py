from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.application.customer_service import CustomerService
from app.infrastructure.db.repositories.customer import CustomerRepository


pytestmark = [pytest.mark.integration, pytest.mark.postgres]


def test_postgres_debt_payments_use_parent_ids_and_recompute_balance(postgres_session: Session) -> None:
    service = CustomerService()
    repository = CustomerRepository()
    customer = service.create_customer(postgres_session, customer_name="Postgres Customer", opening_balance="100")

    first = service.create_debt_payment(postgres_session, customer.id, amount="25")
    second = service.create_debt_payment(postgres_session, customer.id, amount="10")
    ledgers = repository.list_customer_ledgers(postgres_session, customer.id)

    assert first.payment_id != second.payment_id
    assert [ledger.ref_id for ledger in ledgers if ledger.ref_type == "DEBT_PAYMENT"] == [
        first.payment_id,
        second.payment_id,
    ]
    assert customer.current_balance == Decimal("65.00")
