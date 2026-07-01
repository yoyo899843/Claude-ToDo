from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import crud, models
from app.database import get_db


def get_current_user_web(request: Request, db: Session = Depends(get_db)) -> models.User | None:
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    user = db.get(models.User, user_id)
    if not user:
        request.session.clear()
    return user


def get_api_user(
    request: Request,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.User:
    if authorization and authorization.startswith("Bearer "):
        token_value = authorization.removeprefix("Bearer ")
        token = crud.get_api_token_by_value(db, token_value)
        if token:
            return token.user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = request.session.get("user_id")
    if user_id:
        user = db.get(models.User, user_id)
        if user:
            return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
