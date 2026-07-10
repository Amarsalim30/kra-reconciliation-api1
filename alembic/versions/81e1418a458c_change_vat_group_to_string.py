"""change_vat_group_to_string

Revision ID: 81e1418a458c
Revises: 5df3450cc2c3
Create Date: 2026-07-10 18:51:54.121473

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '81e1418a458c'
down_revision: Union[str, Sequence[str], None] = '5df3450cc2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('session_invoices') as batch_op:
        batch_op.alter_column('vat_group',
               type_=sa.String(length=50),
               existing_type=sa.Integer(),
               nullable=False)

    with op.batch_alter_table('session_reconciliation_results') as batch_op:
        batch_op.alter_column('sap_vat_group',
               type_=sa.String(length=50),
               existing_type=sa.Integer(),
               nullable=True)
        batch_op.alter_column('kra_vat_group',
               type_=sa.String(length=50),
               existing_type=sa.Integer(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('session_reconciliation_results') as batch_op:
        batch_op.alter_column('kra_vat_group',
               type_=sa.Integer(),
               existing_type=sa.String(length=50),
               nullable=True)
        batch_op.alter_column('sap_vat_group',
               type_=sa.Integer(),
               existing_type=sa.String(length=50),
               nullable=True)

    with op.batch_alter_table('session_invoices') as batch_op:
        batch_op.alter_column('vat_group',
               type_=sa.Integer(),
               existing_type=sa.String(length=50),
               nullable=False)

