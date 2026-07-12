from app.database.database import SessionLocal
from app.models.reconciliation_session import SessionReconciliationResult

db = SessionLocal()
res = db.query(SessionReconciliationResult).first()
if res:
    print(f"ID: {res.id}, partner_name_matches: {res.partner_name_matches}, pin_matches: {res.pin_matches}")
else:
    print("No results found in DB")
