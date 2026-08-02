from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from sqlalchemy import text

from app import models
from app.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.events import router as events_router
from app.routers.profile import router as profile_router
from app.routers.todos import router as todos_router
from app.routers.web import router as web_router
from app.settings import get_settings


settings = get_settings()
base_dir = Path(__file__).resolve().parent

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(SessionMiddleware, secret_key=settings.secret_key, https_only=False)

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

app.mount("/static", StaticFiles(directory=base_dir / "static"), name="static")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE todos ADD COLUMN IF NOT EXISTS category VARCHAR(100)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_todos_category ON todos (category)"))
        conn.commit()


app.include_router(auth_router)
app.include_router(web_router)
app.include_router(profile_router)
app.include_router(todos_router)
app.include_router(events_router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
