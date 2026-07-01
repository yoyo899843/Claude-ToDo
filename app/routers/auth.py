from pathlib import Path

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db

templates = Jinja2Templates(directory=str(Path(__file__).resolve().parents[1] / "templates"))
router = APIRouter(tags=["auth"])


@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request, db: Session = Depends(get_db)) -> HTMLResponse:
    user_id = request.session.get("user_id")
    if user_id:
        from app import models
        if db.get(models.User, user_id):
            return RedirectResponse("/", status_code=303)
        request.session.clear()
    return templates.TemplateResponse(request, "login.html", {"mode": "login", "error": None})


@router.post("/login", response_class=HTMLResponse)
def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
) -> HTMLResponse:
    user = crud.authenticate_user(db, username, password)
    if not user:
        return templates.TemplateResponse(
            request, "login.html",
            {"mode": "login", "error": "帳號或密碼錯誤"},
            status_code=401,
        )
    request.session["user_id"] = user.id
    return RedirectResponse("/", status_code=303)


@router.get("/register", response_class=HTMLResponse)
def register_page(request: Request, db: Session = Depends(get_db)) -> HTMLResponse:
    user_id = request.session.get("user_id")
    if user_id:
        from app import models
        if db.get(models.User, user_id):
            return RedirectResponse("/", status_code=303)
        request.session.clear()
    return templates.TemplateResponse(request, "login.html", {"mode": "register", "error": None})


@router.post("/register", response_class=HTMLResponse)
def register(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
) -> HTMLResponse:
    if crud.get_user_by_username(db, username):
        return templates.TemplateResponse(
            request, "login.html",
            {"mode": "register", "error": "此帳號名稱已被使用"},
            status_code=400,
        )
    user = crud.create_user(db, username, password)
    request.session["user_id"] = user.id
    return RedirectResponse("/", status_code=303)


@router.post("/logout")
def logout(request: Request) -> RedirectResponse:
    request.session.clear()
    return RedirectResponse("/login", status_code=303)
