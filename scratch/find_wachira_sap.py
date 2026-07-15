import sqlite3
import psycopg

# Search PostgreSQL for CardName like 'JAMES' or 'WACHIRA' or 'KING'
try:
    conn = psycopg.connect("postgresql://kra_user:testing123@localhost:5432/kra_reconciliation")
    cursor = conn.cursor()
    cursor.execute("SELECT id, session_id, row_number, source, invoice_number, partner_name, cu_number, base_amount FROM session_invoices WHERE partner_name LIKE '%JAMES%' OR partner_name LIKE '%WACHIRA%' OR partner_name LIKE '%KING%'")
    rows = cursor.fetchall()
    print("Found in PostgreSQL:")
    for r in rows:
        print(f"  {r}")
    conn.close()
except Exception as e:
    print(f"Error querying PG: {e}")
