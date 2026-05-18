from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Callable, TypeVar

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_session, require_roles
from app.application.inventory_service import InventoryService
from app.domain.auth import UserRole
from app.domain.enums import UnitType
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.inventory import InventoryBalance, Product
from app.schemas.inventory import (
    InventoryBalanceResponse,
    ProductCreateRequest,
    ProductDeleteResponse,
    ProductPriceRequest,
    ProductPriceResponse,
    ProductResponse,
    ProductUpdateRequest,
    StockChangeRequest,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])
SessionDep = Annotated[Session, Depends(get_session)]
InventoryReadDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN, UserRole.READ_ONLY))]
InventoryWriteDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN))]
T = TypeVar("T")


def _enabled_price_map(prices: list[ProductPriceRequest]) -> dict[UnitType, Decimal]:
    return {price.unit_type: price.price for price in prices if price.is_enabled}


def _run_in_transaction(session: Session, operation: Callable[[], T]) -> T:
    try:
        result = operation()
        session.commit()
        return result
    except Exception:
        session.rollback()
        raise


def _balance_response(balance: InventoryBalance | None) -> InventoryBalanceResponse | None:
    if balance is None:
        return None
    return InventoryBalanceResponse(
        product_id=balance.product_id,
        on_hand_bao_decimal=balance.on_hand_bao_decimal,
        on_hand_bich_integer=balance.on_hand_bich_integer,
        updated_at=balance.updated_at,
    )


def _product_response(product: Product) -> ProductResponse:
    prices = sorted(product.prices, key=lambda price: price.unit_type)
    return ProductResponse(
        id=product.id,
        product_code_base=product.product_code_base,
        product_name=product.product_name,
        unit_mode=product.unit_mode,
        is_active=product.is_active,
        created_at=product.created_at,
        updated_at=product.updated_at,
        prices=[
            ProductPriceResponse(unit_type=price.unit_type, price=price.price, is_enabled=price.is_enabled)
            for price in prices
        ],
        balance=_balance_response(product.inventory_balance),
    )


@router.get("/products", response_model=list[ProductResponse])
def list_products(
    session: SessionDep,
    _: InventoryReadDep,
    include_inactive: bool = False,
    search: str = "",
) -> list[ProductResponse]:
    service = InventoryService()
    return [_product_response(product) for product in service.list_products(session, include_inactive=include_inactive, search=search)]


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreateRequest, session: SessionDep, _: InventoryWriteDep) -> ProductResponse:
    service = InventoryService()

    def operation() -> int:
        product = service.create_product(
            session,
            product_code_base=payload.product_code_base,
            product_name=payload.product_name,
            unit_mode=payload.unit_mode,
            enabled_prices=_enabled_price_map(payload.prices),
        )
        return product.id

    product_id = _run_in_transaction(session, operation)
    return _product_response(service.get_product(session, product_id))


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, session: SessionDep, _: InventoryReadDep) -> ProductResponse:
    return _product_response(InventoryService().get_product(session, product_id))


@router.patch("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    payload: ProductUpdateRequest,
    session: SessionDep,
    _: InventoryWriteDep,
) -> ProductResponse:
    service = InventoryService()

    def operation() -> int:
        current = service.get_product(session, product_id)
        product = service.update_product(
            session,
            product_id,
            product_name=payload.product_name,
            unit_mode=current.unit_mode,
            enabled_prices=_enabled_price_map(payload.prices),
        )
        return product.id

    updated_id = _run_in_transaction(session, operation)
    return _product_response(service.get_product(session, updated_id))


@router.delete("/products/{product_id}", response_model=ProductDeleteResponse)
def delete_product(product_id: int, session: SessionDep, _: InventoryWriteDep) -> ProductDeleteResponse:
    result = _run_in_transaction(session, lambda: InventoryService().delete_product(session, product_id))
    return ProductDeleteResponse(product_id=result.product_id, action=result.action)


@router.get("/products/{product_id}/balance", response_model=InventoryBalanceResponse)
def get_product_balance(product_id: int, session: SessionDep, _: InventoryReadDep) -> InventoryBalanceResponse:
    balance = InventoryService().get_or_create_balance(session, product_id)
    return _balance_response(balance)


@router.post("/products/{product_id}/stock/increase", response_model=InventoryBalanceResponse)
def increase_stock(
    product_id: int,
    payload: StockChangeRequest,
    session: SessionDep,
    _: InventoryWriteDep,
) -> InventoryBalanceResponse:
    balance_id = _run_in_transaction(
        session,
        lambda: InventoryService().increase_stock(session, product_id, payload.quantity, payload.unit_type).id,
    )
    balance = session.get(InventoryBalance, balance_id)
    return _balance_response(balance)


@router.post("/products/{product_id}/stock/decrease", response_model=InventoryBalanceResponse)
def decrease_stock(
    product_id: int,
    payload: StockChangeRequest,
    session: SessionDep,
    _: InventoryWriteDep,
) -> InventoryBalanceResponse:
    balance_id = _run_in_transaction(
        session,
        lambda: InventoryService().decrease_stock(session, product_id, payload.quantity, payload.unit_type).id,
    )
    balance = session.get(InventoryBalance, balance_id)
    return _balance_response(balance)
