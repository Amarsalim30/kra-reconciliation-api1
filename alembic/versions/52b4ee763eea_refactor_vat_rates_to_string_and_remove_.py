"""Refactor VAT rates to string and remove enum

Revision ID: 52b4ee763eea
Revises: 6f7b662a0fc3
Create Date: 2026-07-16 04:41:23.053235

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '52b4ee763eea'
down_revision: Union[str, Sequence[str], None] = '6f7b662a0fc3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Rename columns
    op.alter_column('vat_mappings', 'canonical_value', new_column_name='canonical_rate')
    op.alter_column('kra_vat_mappings', 'canonical_value', new_column_name='canonical_rate')
    
    conn = op.get_bind()

    # 2. Snapshot Data Migration
    # We load all rows, normalize in memory, and update.
    # If any value is unknown, we raise ValueError to fail the migration.
    def snapshot_normalize(val: str) -> str:
        v = val.strip().upper()
        if v in ("VAT_16", "16%", "16", "16.0"): return "16"
        if v in ("VAT_8", "8%", "8", "8.0"): return "8"
        if v in ("ZERO_RATED", "0%", "0", "0.0"): return "0"
        if v in ("EXEMPT", "EXEMPTED", "EX", "E") or "EXEMPT" in v: return "EXEMPT"
        raise ValueError(f"Ambiguous historical VAT value encountered: '{val}'. Cannot migrate deterministically.")

    for table_name in ("vat_mappings", "kra_vat_mappings"):
        res = conn.execute(sa.text(f"SELECT id, canonical_rate FROM {table_name}"))
        for row in res.fetchall():
            row_id, raw_val = row[0], row[1]
            if raw_val is None:
                raise ValueError(f"NULL canonical_rate found in {table_name} (id={row_id})")
            norm = snapshot_normalize(raw_val)
            conn.execute(sa.text(f"UPDATE {table_name} SET canonical_rate = :norm WHERE id = :id"), {"norm": norm, "id": row_id})
            
        # Verify Constraint (manually, in case we are on SQLite which doesn't support the Postgres regex constraint above)
        verify = conn.execute(sa.text(f"SELECT id, canonical_rate FROM {table_name}"))
        for row in verify.fetchall():
            row_id, val = row[0], row[1]
            if val != 'EXEMPT' and not __import__('re').match(r'^[0-9]+(\.[0-9]+)?$', val):
                raise ValueError(f"Check constraint violation after migration in {table_name} (id={row_id}): {val}")
                
    # Verify uniqueness in vat_mappings
    duplicates = conn.execute(sa.text("SELECT connection_id, module, sap_code, COUNT(*) FROM vat_mappings GROUP BY connection_id, module, sap_code HAVING COUNT(*) > 1"))
    if duplicates.fetchone():
        raise ValueError("Duplicate SAP VAT mappings found after normalization!")
        
    # Verify uniqueness in kra_vat_mappings
    duplicates = conn.execute(sa.text("SELECT section_prefix, COUNT(*) FROM kra_vat_mappings GROUP BY section_prefix HAVING COUNT(*) > 1"))
    if duplicates.fetchone():
        raise ValueError("Duplicate KRA VAT mappings found after normalization!")

    # 3. Add Postgres Check Constraints
    if conn.engine.dialect.name == 'postgresql':
        op.create_check_constraint(
            'chk_vat_valid_canonical_rate',
            'vat_mappings',
            "canonical_rate = 'EXEMPT' OR canonical_rate ~ '^[0-9]+(\\.[0-9]+)?$'"
        )
        op.create_check_constraint(
            'chk_kra_valid_canonical_rate',
            'kra_vat_mappings',
            "canonical_rate = 'EXEMPT' OR canonical_rate ~ '^[0-9]+(\\.[0-9]+)?$'"
        )

    # 4. Alter type from Enum to String(20)
    # SQLite doesn't natively support altering types, but Alembic can do it via batch op if needed. We'll use standard alter for Postgres.
    if conn.engine.dialect.name == 'postgresql':
        op.alter_column('vat_mappings', 'canonical_rate', type_=sa.String(20), existing_type=sa.VARCHAR(length=50))
        op.alter_column('kra_vat_mappings', 'canonical_rate', type_=sa.String(20), existing_type=sa.VARCHAR(length=50))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    if conn.engine.dialect.name == 'postgresql':
        op.drop_constraint('chk_vat_valid_canonical_rate', 'vat_mappings', type_='check')
        op.drop_constraint('chk_kra_valid_canonical_rate', 'kra_vat_mappings', type_='check')
    op.alter_column('vat_mappings', 'canonical_rate', new_column_name='canonical_value')
    op.alter_column('kra_vat_mappings', 'canonical_rate', new_column_name='canonical_value')
