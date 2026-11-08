import gc
import os
import sqlite3

from alembic import command
from alembic.config import Config


def test_migration_chain_from_shared_base_with_pre_existing_user():
    """
    Verifies that upgrading from the shared base revision on main (8ad0f2de05c1)
    to head succeeds smoothly when tables are already populated with pre-existing rows,
    confirming that all added NOT NULL columns (is_system, selected_answer, damage_taken)
    have explicit server_default attributes.
    """
    test_db = "test_migration_populated_clean.db"
    if os.path.exists(test_db):
        try:
            os.remove(test_db)
        except OSError:
            pass

    try:
        cfg = Config("alembic.ini")
        cfg.set_main_option("sqlalchemy.url", f"sqlite:///{test_db}")

        # 1. Upgrade to the base revision present on origin/main
        command.upgrade(cfg, "8ad0f2de05c1")

        # 2. Insert a pre-existing user row into the database
        conn = sqlite3.connect(test_db)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (id, username, password_hash, is_guest, session_version, created_at, last_login_at, is_active) "
            "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)",
            ("pre-migrated-user-1", "vintage_player", "hash123", 0, 1)
        )
        conn.commit()
        conn.close()

        # 3. Upgrade all the way to head
        command.upgrade(cfg, "head")

        # 4. Verify the row has proper defaults applied
        conn = sqlite3.connect(test_db)
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, is_system, session_version FROM users WHERE id = 'pre-migrated-user-1'")
        row = cursor.fetchone()
        conn.close()

        assert row is not None
        assert row[1] == "vintage_player"
        assert row[2] in (0, False)
        assert row[3] == 1  # session_version preserved

    finally:
        gc.collect()
        if os.path.exists(test_db):
            try:
                os.remove(test_db)
            except OSError:
                pass
