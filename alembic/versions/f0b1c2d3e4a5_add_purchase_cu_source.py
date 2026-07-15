"""Add purchase_cu_source to system_settings

Revision ID: f0b1c2d3e4a5
Revises: 27d2cfa7b5ca
Create Date: 2026-07-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0b1c2d3e4a5'
down_revision: Union[str, Sequence[str], None] = '27d2cfa7b5ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'system_settings',
        sa.Column(
            'purchase_cu_source',
            sa.String(length=50),
            nullable=False,
            server_default='U_CUINV',
            comment='SAP field holding the CU number on Purchase Invoices',
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('system_settings', 'purchase_cu_source')
