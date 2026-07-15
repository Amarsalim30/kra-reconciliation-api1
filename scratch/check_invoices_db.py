import sqlite3
import psycopg
import glob

# 1. Search SQLite test.db and other test dbs
for path in glob.glob("*.db"):
    try:
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='session_invoices'")
        if cursor.fetchone():
            cursor.execute("SELECT id, session_id, row_number, source, invoice_number, cu_number, base_amount FROM session_invoices WHERE invoice_number IN ('1470', '1474')")
            rows = cursor.fetchall()
            if rows:
                print(f"Found in SQLite file {path}:")
                for r in rows:
                    print(f"  {r}")
        conn.close()
    except Exception as e:
        pass

# 2. Search PostgreSQL
try:
    conn = psycopg.connect("postgresql://kra_user:testing123@localhost:5432/kra_reconciliation")
    cursor = conn.cursor()
    cursor.execute("SELECT id, session_id, row_number, source, invoice_number, cu_number, base_amount FROM session_invoices WHERE invoice_number IN ('1470', '1474')")
    rows = cursor.fetchall()
    if rows:
        print("Found in PostgreSQL:")
        for r in rows:
            print(f"  {r}")
    conn.close()
except Exception as e:
    print(f"Error querying PG: {e}")
