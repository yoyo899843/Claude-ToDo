import secrets
from datetime import datetime

import bcrypt
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models import APIToken, Event, Todo, User
from app.schemas import EventCreate, EventUpdate, TodoCreate, TodoUpdate


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

def list_todos(
    db: Session,
    user_id: int,
    completed: bool | None = None,
    q: str | None = None,
    deadline_from: datetime | None = None,
    deadline_to: datetime | None = None,
) -> list[Todo]:
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
    if deadline_from is not None:
        statement = statement.where(Todo.deadline >= deadline_from)
    if deadline_to is not None:
        statement = statement.where(Todo.deadline <= deadline_to)
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


# ── events ────────────────────────────────────────────────────────────────────

def _apply_event_range_filter(statement, from_dt, to_dt):
    # Return events that overlap [from_dt, to_dt]:
    # start_at <= to_dt  AND  (end_at >= from_dt  OR  (no end_at AND start_at >= from_dt))
    if to_dt is not None:
        statement = statement.where(Event.start_at <= to_dt)
    if from_dt is not None:
        statement = statement.where(
            or_(
                Event.end_at >= from_dt,
                and_(Event.end_at.is_(None), Event.start_at >= from_dt),
            )
        )
    return statement


def list_events(
    db: Session,
    user_id: int,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
) -> list[Event]:
    statement = select(Event).where(Event.user_id == user_id).order_by(Event.start_at.asc())
    return list(db.scalars(_apply_event_range_filter(statement, from_dt, to_dt)).all())


def list_all_events(
    db: Session,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
) -> list[Event]:
    statement = select(Event).order_by(Event.start_at.asc())
    return list(db.scalars(_apply_event_range_filter(statement, from_dt, to_dt)).all())


def get_event(db: Session, event_id: int) -> Event | None:
    return db.get(Event, event_id)


def create_event(db: Session, user_id: int, event_in: EventCreate) -> Event:
    event = Event(user_id=user_id, **event_in.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def update_event(db: Session, event: Event, event_in: EventUpdate) -> Event:
    for field, value in event_in.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, event: Event) -> None:
    db.delete(event)
    db.commit()
