from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app import crud, models
from app.database import get_db
from app.deps import get_api_user
from app.schemas import TodoCreate, TodoListResponse, TodoRead, TodoUpdate


router = APIRouter(prefix="/api/v1/todos", tags=["todos"])


@router.get("", response_model=TodoListResponse)
def read_todos(
    completed: bool | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    deadline_from: datetime | None = Query(default=None),
    deadline_to: datetime | None = Query(default=None),
    category: str | None = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> TodoListResponse:
    todos = crud.list_todos(
        db, user_id=user.id, completed=completed, q=q,
        deadline_from=deadline_from, deadline_to=deadline_to,
        category=category,
    )
    return TodoListResponse(items=todos, total=len(todos))


# Must be before /{todo_id} so the static segment matches first
@router.get("/categories", response_model=list[str])
def read_categories(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> list[str]:
    return crud.list_categories(db, user.id)


@router.post("", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create_todo(
    todo_in: TodoCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> TodoRead:
    return crud.create_todo(db, user_id=user.id, todo_in=todo_in)


@router.get("/{todo_id}", response_model=TodoRead)
def read_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> TodoRead:
    todo = crud.get_todo(db, todo_id)
    if todo is None or todo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    return todo


@router.patch("/{todo_id}", response_model=TodoRead)
def update_todo(
    todo_id: int,
    todo_in: TodoUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> TodoRead:
    todo = crud.get_todo(db, todo_id)
    if todo is None or todo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    return crud.update_todo(db, todo, todo_in)


@router.post("/{todo_id}/toggle", response_model=TodoRead)
def toggle_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> TodoRead:
    todo = crud.get_todo(db, todo_id)
    if todo is None or todo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    return crud.toggle_todo(db, todo)


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> Response:
    todo = crud.get_todo(db, todo_id)
    if todo is None or todo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    crud.delete_todo(db, todo)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
