from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import get_current_user_web

templates = Jinja2Templates(directory=str(Path(__file__).resolve().parents[1] / "templates"))
router = APIRouter(tags=["web"])


@router.get("/", response_class=HTMLResponse)
def home(
    request: Request,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_current_user_web),
) -> HTMLResponse:
    if not user:
        return RedirectResponse("/login", status_code=303)
    return templates.TemplateResponse(request, "index.html", {"active_page": "home", "user": user})


@router.get("/api-docs", response_class=HTMLResponse)
def api_docs(
    request: Request,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_current_user_web),
) -> HTMLResponse:
    return templates.TemplateResponse(request, "api.html", {"active_page": "api", "user": user})
