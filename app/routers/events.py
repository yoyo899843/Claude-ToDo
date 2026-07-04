from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app import crud, models
from app.database import get_db
from app.deps import get_api_user
from app.schemas import EventCreate, EventListResponse, EventRead, EventUpdate

router = APIRouter(prefix="/api/v1/events", tags=["events"])


@router.get("", response_model=EventListResponse)
def read_events(
    from_dt: datetime | None = Query(default=None, alias="from"),
    to_dt: datetime | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> EventListResponse:
    events = crud.list_events(db, user_id=user.id, from_dt=from_dt, to_dt=to_dt)
    return EventListResponse(items=events, total=len(events))


@router.post("", response_model=EventRead, status_code=status.HTTP_201_CREATED)
def create_event(
    event_in: EventCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> EventRead:
    return crud.create_event(db, user_id=user.id, event_in=event_in)


# /public must be defined before /{event_id} so the static segment wins over the int param
@router.get("/public", response_model=EventListResponse)
def read_events_public(
    from_dt: datetime | None = Query(default=None, alias="from"),
    to_dt: datetime | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
) -> EventListResponse:
    events = crud.list_all_events(db, from_dt=from_dt, to_dt=to_dt)
    return EventListResponse(items=events, total=len(events))


@router.get("/{event_id}", response_model=EventRead)
def read_event(
    event_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> EventRead:
    event = crud.get_event(db, event_id)
    if event is None or event.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.patch("/{event_id}", response_model=EventRead)
def update_event(
    event_id: int,
    event_in: EventUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> EventRead:
    event = crud.get_event(db, event_id)
    if event is None or event.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return crud.update_event(db, event, event_in)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_api_user),
) -> Response:
    event = crud.get_event(db, event_id)
    if event is None or event.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    crud.delete_event(db, event)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
