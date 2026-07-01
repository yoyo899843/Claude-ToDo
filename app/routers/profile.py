from pathlib import Path

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app import crud, models
from app.database import get_db
from app.deps import get_current_user_web

templates = Jinja2Templates(directory=str(Path(__file__).resolve().parents[1] / "templates"))
router = APIRouter(tags=["profile"])


@router.get("/profile", response_class=HTMLResponse)
def profile_page(
    request: Request,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_current_user_web),
) -> HTMLResponse:
    if not user:
        return RedirectResponse("/login", status_code=303)
    tokens = crud.list_api_tokens(db, user.id)
    flash_token = request.session.pop("flash_token", None)
    return templates.TemplateResponse(
        request, "profile.html",
        {"active_page": "profile", "user": user, "tokens": tokens, "flash_token": flash_token},
    )


@router.post("/profile/tokens", response_class=HTMLResponse)
def create_token(
    request: Request,
    name: str = Form(..., min_length=1, max_length=100),
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_current_user_web),
) -> HTMLResponse:
    if not user:
        return RedirectResponse("/login", status_code=303)
    token = crud.create_api_token(db, user.id, name)
    request.session["flash_token"] = token.token
    return RedirectResponse("/profile", status_code=303)


@router.post("/profile/tokens/{token_id}/delete", response_class=HTMLResponse)
def delete_token(
    token_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_current_user_web),
) -> HTMLResponse:
    if not user:
        return RedirectResponse("/login", status_code=303)
    crud.delete_api_token(db, user.id, token_id)
    return RedirectResponse("/profile", status_code=303)
