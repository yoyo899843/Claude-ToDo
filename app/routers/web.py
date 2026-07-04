from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse
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


@router.get("/calendar", response_class=HTMLResponse)
def calendar_page(
    request: Request,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_current_user_web),
) -> HTMLResponse:
    if not user:
        return RedirectResponse("/login", status_code=303)
    return templates.TemplateResponse(request, "calendar.html", {"active_page": "calendar", "user": user})


@router.get("/claude", response_class=HTMLResponse)
def claude_guide(
    request: Request,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(get_current_user_web),
) -> HTMLResponse:
    if not user:
        return RedirectResponse("/login", status_code=303)
    return templates.TemplateResponse(request, "claude.html", {"active_page": "claude", "user": user})


@router.get("/claude.md", response_class=PlainTextResponse)
def claude_md(request: Request) -> PlainTextResponse:
    base = str(request.base_url).rstrip("/")
    content = f"""# Claude Todo API Guide

## Base URL
{base}

## Authentication
All `/api/v1/` endpoints require:
```
Authorization: Bearer <token>
Content-Type: application/json
```

## Todo Endpoints

### List todos
```
GET /api/v1/todos
```
Query params (all optional):
- `completed=true|false` — filter by status
- `q=keyword` — search title/description

Response:
```json
{{"items": [{{"id": 1, "title": "...", "description": "...", "completed": false, "deadline": "2026-07-10T10:00:00Z", "created_at": "...", "updated_at": "..."}}], "total": 1}}
```

### Create todo
```
POST /api/v1/todos
```
Body:
```json
{{"title": "Task title", "description": "Details or links (optional)", "deadline": "2026-07-10T10:00:00Z (optional, UTC ISO 8601)"}}
```
Response: `201` with the created todo object.

### Update todo
```
PATCH /api/v1/todos/{{id}}
```
Body (all fields optional):
```json
{{"title": "New title", "description": "New description", "completed": true, "deadline": "2026-07-10T10:00:00Z"}}
```

### Delete todo
```
DELETE /api/v1/todos/{{id}}
```
Response: `204 No Content`

## Sort Order
Todos are returned sorted by: active first → earliest deadline first → recently updated first. Todos without a deadline appear at the bottom of the active group.

## Gmail Organisation Workflow
1. Use Gmail connector to list unread emails (subject + from + date only) — don't read full content yet.
2. Classify by subject:
   - Promotional / newsletter → archive, no todo
   - Action required (payment, signing, confirmation) → read email, create todo with summary + link in description
   - Meeting / event → create todo with deadline set to event time, put Meet/Zoom link in description
   - General notification → mark read + archive
3. Before executing, state your plan and wait for confirmation.
4. Always use UTC ISO 8601 for deadlines (e.g. `2026-07-10T10:00:00Z`).
5. Do not delete todos unless explicitly asked.
"""
    return PlainTextResponse(content, media_type="text/markdown; charset=utf-8")
