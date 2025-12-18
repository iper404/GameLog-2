import os
import requests
from fastapi import Header, HTTPException
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is missing in backend/.env")
if not SUPABASE_ANON_KEY:
    raise RuntimeError("SUPABASE_ANON_KEY is missing in backend/.env")

def get_user_id(authorization: str | None = Header(default=None)) -> str:
    """
    Validates the Supabase access token by calling Supabase directly.
    If valid, returns the user's id.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.split(" ", 1)[1].strip()

    try:
        res = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,  # required by Supabase
            },
            timeout=10,
        )

        if res.status_code != 200:
            # Return Supabase's response for easier debugging
            raise HTTPException(status_code=401, detail=res.text)

        data = res.json()
        user_id = data.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Supabase user response missing id")

        return user_id

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Auth verification failed")
