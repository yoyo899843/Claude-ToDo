# Claude To-Do

FastAPI + PostgreSQL + Docker Compose todo app with a browser UI and an AI-friendly JSON API.

## Structure

- `app/main.py` for application setup, middleware, static files, and router registration
- `app/routers/` for the todo API and web page routes
- `app/templates/` and `app/static/` for browser-facing assets
- `main.py` as a thin local entrypoint for development

## Run

```bash
docker compose up --build
```

Open:

- http://localhost:8000 for the web UI
- http://localhost:8000/docs for Swagger UI
- http://localhost:8000/openapi.json for machine clients

## API

- `GET /api/v1/todos`
- `POST /api/v1/todos`
- `GET /api/v1/todos/{todo_id}`
- `PATCH /api/v1/todos/{todo_id}`
- `POST /api/v1/todos/{todo_id}/toggle`
- `DELETE /api/v1/todos/{todo_id}`# Claude-ToDo
