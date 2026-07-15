"""Redesign settings module schema & seed tax metadata

Revision ID: f89a12b3c4d5
Revises: 442da9e37d7f
Create Date: 2026-07-15 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f89a12b3c4d5'
down_revision: Union[str, Sequence[str], None] = 'a15d71db5db4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create vat_buckets table
    op.create_table(
        'vat_buckets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=False),
        sa.Column('percentage', sa.Numeric(precision=4, scale=2), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_vat_buckets')),
        sa.UniqueConstraint('code', name=op.f('uq_vat_buckets_code'))
    )
    op.create_index(op.f('ix_vat_buckets_code'), 'vat_buckets', ['code'], unique=True)
    op.create_index(op.f('ix_vat_buckets_id'), 'vat_buckets', ['id'], unique=False)

    # 2. Create kra_sections table
    op.create_table(
        'kra_sections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('section_code', sa.String(length=50), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('expected_vat_bucket_id', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['expected_vat_bucket_id'], ['vat_buckets.id'], name=op.f('fk_kra_sections_expected_vat_bucket_id_vat_buckets'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_kra_sections')),
        sa.UniqueConstraint('section_code', name=op.f('uq_kra_sections_section_code'))
    )
    op.create_index(op.f('ix_kra_sections_id'), 'kra_sections', ['id'], unique=False)
    op.create_index(op.f('ix_kra_sections_section_code'), 'kra_sections', ['section_code'], unique=True)

    # 3. Create kra_section_allowed_vat table
    op.create_table(
        'kra_section_allowed_vat',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('section_id', sa.Integer(), nullable=False),
        sa.Column('vat_bucket_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['kra_sections.id'], name=op.f('fk_kra_section_allowed_vat_section_id_kra_sections'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['vat_bucket_id'], ['vat_buckets.id'], name=op.f('fk_kra_section_allowed_vat_vat_bucket_id_vat_buckets'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_kra_section_allowed_vat'))
    )
    op.create_index(op.f('ix_kra_section_allowed_vat_id'), 'kra_section_allowed_vat', ['id'], unique=False)

    # 4. Create sap_vat_mappings table
    op.create_table(
        'sap_vat_mappings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('connection_id', sa.Integer(), nullable=False),
        sa.Column('module', sa.String(length=20), nullable=False),
        sa.Column('sap_code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=200), nullable=False, server_default=''),
        sa.Column('vat_bucket_id', sa.Integer(), nullable=False),
        sa.Column('is_builtin', sa.Boolean(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['connection_id'], ['sap_connections.id'], name=op.f('fk_sap_vat_mappings_connection_id_sap_connections'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['vat_bucket_id'], ['vat_buckets.id'], name=op.f('fk_sap_vat_mappings_vat_bucket_id_vat_buckets'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_sap_vat_mappings')),
        sa.UniqueConstraint('connection_id', 'module', 'sap_code', name='uq_sap_vat_mapping_code')
    )
    op.create_index(op.f('ix_sap_vat_mappings_id'), 'sap_vat_mappings', ['id'], unique=False)

    # 5. Modify sap_connections
    with op.batch_alter_table('sap_connections') as batch_op:
        batch_op.add_column(sa.Column('last_tested_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('last_status', sa.String(length=50), nullable=True, server_default='UNKNOWN'))

    # 6. Modify system_settings
    with op.batch_alter_table('system_settings') as batch_op:
        batch_op.add_column(sa.Column('date_tolerance', sa.Integer(), nullable=False, server_default='3'))
        batch_op.add_column(sa.Column('partner_similarity_threshold', sa.Numeric(precision=3, scale=2), nullable=False, server_default='0.85'))
        try:
            batch_op.drop_column('base_amount_policy')
            batch_op.drop_column('unmapped_vat_policy')
            batch_op.drop_column('ignore_missing_cu')
            batch_op.drop_column('include_credit_notes')
            batch_op.drop_column('include_debit_notes')
            batch_op.drop_column('skip_cancelled')
            batch_op.drop_column('kra_section_mappings')
        except Exception:
            pass

    # 7. Modify setting_audit_logs
    with op.batch_alter_table('setting_audit_logs') as batch_op:
        batch_op.add_column(sa.Column('ip_address', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('entity', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('entity_id', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('field', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('old_value', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('new_value', sa.Text(), nullable=True))

    # 8. Modify reconciliation_sessions
    with op.batch_alter_table('reconciliation_sessions') as batch_op:
        batch_op.add_column(sa.Column('snapshot_operational', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('snapshot_configuration_hash', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('snapshot_sap_connection_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('snapshot_application_version', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('snapshot_tax_mappings_json', sa.JSON(), nullable=True))

    # 9. SEED CANONICAL TAX METADATA
    vat_buckets_table = sa.table(
        'vat_buckets',
        sa.column('id', sa.Integer),
        sa.column('code', sa.String),
        sa.column('display_name', sa.String),
        sa.column('percentage', sa.Numeric),
        sa.column('category', sa.String)
    )

    op.bulk_insert(
        vat_buckets_table,
        [
            {'id': 1, 'code': 'STANDARD', 'display_name': 'Standard Rate (16%)', 'percentage': 16.00, 'category': 'Standard'},
            {'id': 2, 'code': 'REDUCED', 'display_name': 'Reduced Rate (8%)', 'percentage': 8.00, 'category': 'Reduced'},
            {'id': 3, 'code': 'ZERO', 'display_name': 'Zero Rated (0%)', 'percentage': 0.00, 'category': 'Zero'},
            {'id': 4, 'code': 'EXEMPT', 'display_name': 'Exempt Tax Free', 'percentage': None, 'category': 'Exempt'},
        ]
    )

    kra_sections_table = sa.table(
        'kra_sections',
        sa.column('id', sa.Integer),
        sa.column('section_code', sa.String),
        sa.column('display_name', sa.String),
        sa.column('description', sa.String),
        sa.column('expected_vat_bucket_id', sa.Integer),
        sa.column('enabled', sa.Boolean),
        sa.column('sort_order', sa.Integer)
    )

    op.bulk_insert(
        kra_sections_table,
        [
            {'id': 1, 'section_code': 'SEC_B', 'display_name': 'Section B', 'description': 'Standard Rated Sales (16%)', 'expected_vat_bucket_id': 1, 'enabled': True, 'sort_order': 1},
            {'id': 2, 'section_code': 'SEC_F', 'display_name': 'Section F', 'description': 'Standard Rated Purchases (16%)', 'expected_vat_bucket_id': 1, 'enabled': True, 'sort_order': 2},
            {'id': 3, 'section_code': 'SEC_G', 'display_name': 'Section G', 'description': 'Other Rated Purchases (8%)', 'expected_vat_bucket_id': 2, 'enabled': True, 'sort_order': 3},
            {'id': 4, 'section_code': 'SEC_H', 'display_name': 'Section H', 'description': 'Zero Rated Purchases (0%)', 'expected_vat_bucket_id': 3, 'enabled': True, 'sort_order': 4},
            {'id': 5, 'section_code': 'SEC_I', 'display_name': 'Section I', 'description': 'Exempt Purchases', 'expected_vat_bucket_id': 4, 'enabled': True, 'sort_order': 5},
        ]
    )

    allowed_table = sa.table(
        'kra_section_allowed_vat',
        sa.column('id', sa.Integer),
        sa.column('section_id', sa.Integer),
        sa.column('vat_bucket_id', sa.Integer)
    )

    op.bulk_insert(
        allowed_table,
        [
            {'id': 1, 'section_id': 1, 'vat_bucket_id': 1}, # SEC_B -> STANDARD
            {'id': 2, 'section_id': 2, 'vat_bucket_id': 1}, # SEC_F -> STANDARD
            {'id': 3, 'section_id': 3, 'vat_bucket_id': 2}, # SEC_G -> REDUCED
            {'id': 4, 'section_id': 4, 'vat_bucket_id': 3}, # SEC_H -> ZERO
            {'id': 5, 'section_id': 5, 'vat_bucket_id': 4}, # SEC_I -> EXEMPT
        ]
    )


def downgrade() -> None:
    op.drop_table('kra_section_allowed_vat')
    op.drop_table('sap_vat_mappings')
    op.drop_table('kra_sections')
    op.drop_table('vat_buckets')
