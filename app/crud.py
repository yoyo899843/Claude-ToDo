import secrets

import bcrypt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import APIToken, Todo, User
from app.schemas import TodoCreate, TodoUpdate


# ── users ─────────────────────────────────────────────────────────────────────

def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))


def create_user(db: Session, username: str, password: str) -> User:
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user = User(username=username, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
        return None
    return user


# ── api tokens ────────────────────────────────────────────────────────────────

def list_api_tokens(db: Session, user_id: int) -> list[APIToken]:
    return list(db.scalars(select(APIToken).where(APIToken.user_id == user_id).order_by(APIToken.created_at.desc())).all())


def create_api_token(db: Session, user_id: int, name: str) -> APIToken:
    token = APIToken(user_id=user_id, name=name, token=secrets.token_urlsafe(32))
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


def get_api_token_by_value(db: Session, token_value: str) -> APIToken | None:
    return db.scalar(select(APIToken).where(APIToken.token == token_value))


def delete_api_token(db: Session, user_id: int, token_id: int) -> None:
    token = db.scalar(select(APIToken).where(APIToken.id == token_id, APIToken.user_id == user_id))
    if token:
        db.delete(token)
        db.commit()


# ── todos ─────────────────────────────────────────────────────────────────────

def list_todos(db: Session, user_id: int, completed: bool | None = None, q: str | None = None) -> list[Todo]:
    statement = (
        select(Todo)
        .where(Todo.user_id == user_id)
        .order_by(Todo.completed.asc(), Todo.deadline.asc(), Todo.updated_at.desc(), Todo.id.desc())
    )
    if completed is not None:
        statement = statement.where(Todo.completed.is_(completed))
    if q:
        pattern = f"%{q}%"
        statement = statement.where(Todo.title.ilike(pattern) | Todo.description.ilike(pattern))
    return list(db.scalars(statement).all())


def get_todo(db: Session, todo_id: int) -> Todo | None:
    return db.get(Todo, todo_id)


def create_todo(db: Session, user_id: int, todo_in: TodoCreate) -> Todo:
    todo = Todo(
        user_id=user_id,
        title=todo_in.title,
        description=todo_in.description,
        deadline=todo_in.deadline,
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


def update_todo(db: Session, todo: Todo, todo_in: TodoUpdate) -> Todo:
    data = todo_in.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(todo, field, value)
    db.commit()
    db.refresh(todo)
    return todo


def delete_todo(db: Session, todo: Todo) -> None:
    db.delete(todo)
    db.commit()


def toggle_todo(db: Session, todo: Todo) -> Todo:
    todo.completed = not todo.completed
    db.commit()
    db.refresh(todo)
    return todo
