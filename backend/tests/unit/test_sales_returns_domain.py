from __future__ import annotations

from app.domain.documents import DocumentType
from app.domain.returns import ReturnHandlingMode
from app.domain.sales import InvoiceStatus, PaymentMethod


def test_invoice_status_values_match_desktop_data() -> None:
    assert InvoiceStatus.COMPLETED.value == "COMPLETED"


def test_payment_method_values_match_desktop_data() -> None:
    assert PaymentMethod.CASH.value == "CASH"
    assert PaymentMethod.BANK_TRANSFER.value == "BANK_TRANSFER"
    assert PaymentMethod.CARD.value == "CARD"
    assert PaymentMethod.OTHER.value == "OTHER"


def test_return_handling_mode_values_match_desktop_data() -> None:
    assert ReturnHandlingMode.REFUND_NOW.value == "REFUND_NOW"
    assert ReturnHandlingMode.STORE_CREDIT.value == "STORE_CREDIT"


def test_document_type_values() -> None:
    assert DocumentType.INVOICE.value == "INVOICE"
    assert DocumentType.RETURN.value == "RETURN"
