import sys
from app.database.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password

db = SessionLocal()
admin = db.query(User).filter_by(username="admin_tester").first()
if not admin:
    admin = User(username="admin_tester", email="admin@test.com", password_hash=hash_password("securepass123"), is_active=True, role="admin")
    db.add(admin)
    db.commit()
    print("Created admin user")
else:
    print("Admin user already exists")
