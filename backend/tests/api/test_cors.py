from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_inventory_preflight_from_local_vite_origin_is_handled() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/inventory/products",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

    assert response.status_code in {200, 204}
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "POST" in response.headers["access-control-allow-methods"]


def test_health_still_works_with_cors_middleware() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "QuanLyHangHoaWeb"}
