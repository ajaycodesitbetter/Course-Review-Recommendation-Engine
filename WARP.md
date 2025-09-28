# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

Environment setup (Windows PowerShell):
- Create and activate a virtual environment:
  - `python -m venv .venv`
  - `.venv\Scripts\Activate.ps1`
- Install dependencies:
  - `pip install -r requirements.txt`

Run the backend (FastAPI):
- Hot-reload server (preferred during development):
  - `uvicorn main:app --reload --host 127.0.0.1 --port 8000`
- Or run the module directly:
  - `python main.py`

Quick checks:
- API docs (Swagger): http://127.0.0.1:8000/docs
- Health/status: http://127.0.0.1:8000/api
- Frontend: http://127.0.0.1:8000/

Endpoint smoke tests (PowerShell):
- `Invoke-RestMethod "http://127.0.0.1:8000/api"`
- `Invoke-RestMethod "http://127.0.0.1:8000/search?query=python" | Select-Object -First 1`
- `Invoke-RestMethod "http://127.0.0.1:8000/trending" | Select-Object -First 1`

Data processing (optional, if you need to regenerate local data):
- `python process_data.py`
  - Note: the script references a local CSV path; update `input_file` inside `process_data.py` if needed.

Configuration:
- Ensure a `config.env` file exists at the repo root with at least:
  - `BACKEND_BASE_URL`, and (if using Udemy personalization) `UDEMY_API_KEY`.
  - See README.md for the full example.

## High-level architecture

Overview:
- Single FastAPI backend serving a static, vanilla JavaScript frontend (Tailwind via CDN).
- Local dataset powers search, trending, and top-rated. Optional Udemy API is used for personalized recommendations.

Backend (FastAPI – main.py):
- Entry: `main.py` defines `app` and starts Uvicorn in `__main__`.
- Startup initializes:
  - Async `aiohttp` session pool for outbound API calls.
  - Loads courses from `courses_data.feather` (preferred) or `courses_data.csv` if present.
  - Optionally loads `course_embeddings_float16.npy` for vector similarity.
- Endpoints:
  - `GET /` → serves `index.html`.
  - `GET /api` → backend health/status.
  - `GET /model/status` → reports model/API readiness (Udemy key configured or not).
  - `GET /search?query=...` → local search across title/category/description/instructor with scoring.
  - `GET /recommendations?course_id=...` → similarity or category-based recommendations.
  - `GET /trending` → by subscriber count.
  - `GET /top-rated` → by rating with basic quality filters.
  - `POST /recommendations/user` → optional personalized fetch via Udemy API (requires `UDEMY_API_KEY`).
  - `GET /categories` → curated category list for UI.
- Static assets:
  - Mounted at `/static` from repo root; explicit routes for `style.css`, `main.js`, `config.js`, `tailwind-config.js`, and `assets/*`.
- Configuration:
  - `config.py` loads `config.env`, validates required fields, and prints non-sensitive config when `DEBUG=true`.
- Data & ML:
  - Dataframes via pandas; TF–IDF/cosine similarity via scikit-learn (when embeddings exist).
  - Text cleanup via `ftfy`; fuzzy matching via `rapidfuzz` (used in helpers).

Frontend (vanilla JS + Tailwind):
- `index.html` (UI shell), `style.css` (custom styling/animations), `tailwind-config.js` (animations/utilities), `main.js` (all UI logic and API calls), `config.js` (client-side config provider).
- Uses Lucide icons and Tailwind CDN; no bundler/build step required.
- Talks to the FastAPI endpoints listed above.

Data processing:
- `process_data.py` transforms a raw Udemy CSV into `courses_data.csv` and `courses_data.feather`, and generates `course_embeddings_float16.npy`.
- Update the `input_file` path in the script to point at your local dataset before running.

Notes on legacy code:
- `app.py` contains an older MoviesMate (TMDB) API. The active CourseMate backend is `main.py`. Prefer `main.py` for all development.

## Important references from README.md
- Quick start includes cloning, dependency install, creating `config.env`, and running `python main.py`.
- Documented endpoints: `/`, `/api`, `/search`, `/recommendations`, `/trending`, `/top-rated`.
- Current state: local course data and embeddings are already present in the repo; static files are served directly by `main.py`.

## Key files
- `main.py` – FastAPI backend (CourseMate).
- `config.py` / `config.env` – configuration loading & validation.
- `index.html`, `main.js`, `style.css`, `tailwind-config.js`, `config.js`, `assets/` – frontend.
- `process_data.py`, `courses_data.csv` (and optional `courses_data.feather`, `course_embeddings_float16.npy`) – data pipeline outputs.
- `requirements.txt` – backend dependencies.

