"""rename_customer_to_partner_and_add_session_type

Revision ID: df869f8ed9f8
Revises: 81e1418a458c
Create Date: 2026-07-10 20:03:27.449244

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df869f8ed9f8'
down_revision: Union[str, Sequence[str], None] = '81e1418a458c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add session_type column with a server default to populate existing sessions as 'sales'
    with op.batch_alter_table('reconciliation_sessions') as batch_op:
        batch_op.add_column(sa.Column('session_type', sa.Enum('sales', 'purchases', name='reconciliationtype', native_enum=False), nullable=False, server_default='sales'))
    
    # Rename columns to maintain generic partner terminology
    with op.batch_alter_table('session_invoices') as batch_op:
        batch_op.alter_column('customer_name', new_column_name='partner_name')
    with op.batch_alter_table('session_reconciliation_results') as batch_op:
        batch_op.alter_column('sap_customer_name', new_column_name='sap_partner_name')
        batch_op.alter_column('kra_customer_name', new_column_name='kra_partner_name')


def downgrade() -> None:
    # Revert renamed columns
    with op.batch_alter_table('session_invoices') as batch_op:
        batch_op.alter_column('partner_name', new_column_name='customer_name')
    with op.batch_alter_table('session_reconciliation_results') as batch_op:
        batch_op.alter_column('sap_partner_name', new_column_name='sap_customer_name')
        batch_op.alter_column('kra_partner_name', new_column_name='kra_customer_name')
    
    # Remove session_type
    with op.batch_alter_table('reconciliation_sessions') as batch_op:
        batch_op.drop_column('session_type')

