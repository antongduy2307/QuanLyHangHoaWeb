from __future__ import annotations

from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_ROOT / "alembic" / "versions" / "20260517_0004_auth_schema.py"


def test_auth_migration_script_exists() -> None:
    assert MIGRATION_PATH.exists()


def test_auth_migration_creates_expected_tables() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    assert 'op.create_table(\n        "users"' in migration_text
    assert 'op.create_table(\n        "refresh_tokens"' in migration_text


def test_auth_migration_contains_expected_constraints_and_indexes() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    for expected_name in (
        "ck_users_username_not_blank",
        "ck_users_display_name_not_blank",
        "ck_users_password_hash_not_blank",
        "ck_users_role_known",
        "ix_users_username",
        "ix_users_email_unique_not_null",
        "ix_users_role_is_active",
        "ix_refresh_tokens_token_hash",
        "ix_refresh_tokens_expires_at",
        "ix_refresh_tokens_user_revoked",
    ):
        assert expected_name in migration_text
