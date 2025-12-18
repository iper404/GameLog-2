import os
from dotenv import load_dotenv
from sqlmodel import create_engine, Session

load_dotenv()  # loads backend/.env

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing. Add it to backend/.env")

# Supabase hosted Postgres usually requires SSL. If your URL already contains sslmode=, do nothing.
connect_args = {}
if "supabase.co" in DATABASE_URL and "sslmode=" not in DATABASE_URL:
    connect_args = {"sslmode": "require"}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

def get_session():
    """FastAPI dependency that yields a SQLModel session."""
    with Session(engine) as session:
        yield session
