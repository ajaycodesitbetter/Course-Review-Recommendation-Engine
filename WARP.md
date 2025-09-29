# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

Environment setup (Windows PowerShell):
- Create and activate a virtual environment:
  - `python -m venv .venv`
  - `.venv\Scripts\Activate.ps1`
- Install dependencies:
  - `pip install -r requirements.txt`
- Validate setup (creates default config.env if missing):
  - `python setup.py`

Run the backend (FastAPI):
- Hot-reload server (preferred during development):
  - `uvicorn main:app --reload --host 127.0.0.1 --port 8000`
- Or run the module directly:
  - `python main.py`
- Quick test of backend endpoints and data loading:
  - `python test_backend.py`

Quick checks:
- API docs (Swagger): http://127.0.0.1:8000/docs
- Health/status: http://127.0.0.1:8000/api
- Frontend: http://127.0.0.1:8000/

Endpoint smoke tests (PowerShell):
- `Invoke-RestMethod "http://127.0.0.1:8000/api"`
- `Invoke-RestMethod "http://127.0.0.1:8000/search?query=python" | Select-Object -First 1`
- `Invoke-RestMethod "http://127.0.0.1:8000/trending" | Select-Object -First 1`
- `Invoke-RestMethod "http://127.0.0.1:8000/top-rated" | Select-Object -First 1`

Data processing (optional, if you need to regenerate local data):
- `python process_data.py`
  - Note: the script references a local CSV path; update `input_file` inside `process_data.py` if needed.

Configuration:
- Ensure a `config.env` file exists at the repo root with at least:
  - `BACKEND_BASE_URL`, and (if using Udemy personalization) `UDEMY_API_KEY`.
  - See README.md for the full example.
- Alternative data paths can be set in `config.env`:
  - `COURSES_DATA_FILE=C:\path\to\courses_data.feather` (preferred) or `.csv`
  - `EMBEDDINGS_FILE=C:\path\to\course_embeddings_float16.npy` (for similarity search)

## High-level architecture

Overview:
- Single FastAPI backend serving a static, vanilla JavaScript frontend (Tailwind via CDN).
- Local dataset (98,104 courses) powers search, trending, and top-rated endpoints with real-time ML-based recommendations.
- Optional Udemy API is used for personalized recommendations (requires API key).

Backend (FastAPI – main.py):
- Entry: `main.py` defines `app` and starts Uvicorn in `__main__`.
- Startup initializes:
  - Async `aiohttp` session pool for outbound API calls.
  - Loads courses from `courses_data.feather` (preferred) or `courses_data.csv` if present.
  - Loads `course_embeddings_float16.npy` for ML-based similarity search (5000-dimension vectors).
- Endpoints:
  - `GET /` → serves `index.html`.
  - `GET /api` → backend health/status.
  - `GET /model/status` → reports model/API readiness (Udemy key configured or not).
  - `GET /search?query=...` → local search across title/category/description/instructor with scoring.
  - `GET /recommendations?course_id=...` → similarity or category-based recommendations.
  - `GET /trending` → by subscriber count (98K courses).
  - `GET /top-rated` → by rating with basic quality filters.
  - `POST /recommendations/user` → optional personalized fetch via Udemy API (requires `UDEMY_API_KEY`).
  - `GET /categories` → curated category list for UI.
- Static assets:
  - Mounted at `/static` from repo root; explicit routes for `style.css`, `main.js`, `config.js`, `tailwind-config.js`, and `assets/*`.
- Configuration:
  - `config.py` loads `config.env`, validates required fields, and prints non-sensitive config when `DEBUG=true`.
  - Default configuration works out-of-the-box, but can be customized via `config.env`.
- Data & ML:
  - Dataframes via pandas; TF–IDF/cosine similarity via scikit-learn for course recommendations.
  - Text cleanup via `ftfy`; fuzzy matching via `rapidfuzz` for search quality improvement.
  - Course similarity calculation uses TF-IDF vectors with 5000 features for accurate matching.

Frontend (vanilla JS + Tailwind):
- `index.html` (UI shell), `style.css` (custom styling/animations), `tailwind-config.js` (animations/utilities), `main.js` (all UI logic and API calls), `config.js` (client-side config provider).
- Uses Lucide icons and Tailwind CSS (via CDN); no bundler/build step required.
- Key UI features:
  - Search with live suggestions
  - Horizontal scrolling course carousels with navigation controls
  - Trending and top-rated course sections
  - Course detail modals with recommendations
  - Watchlist functionality with local storage persistence
  - User profile and preferences management
- Talks to the FastAPI endpoints listed above with automatic error handling and fallbacks.

Data processing:
- `process_data.py` transforms a raw Udemy CSV into `courses_data.csv` and `courses_data.feather`, and generates `course_embeddings_float16.npy`.
- Update the `input_file` path in the script to point at your local dataset before running.

Notes on legacy code:
- `app.py` contains an older MoviesMate (TMDB) API. The active CourseScout backend is `main.py`. Prefer `main.py` for all development.
- `main_old.js` and `main_old.py` are previous versions and can be safely ignored.

## Important references from README.md
- Quick start includes cloning, dependency install, creating `config.env`, and running `python main.py`.
- Documented endpoints: `/`, `/api`, `/search`, `/recommendations`, `/trending`, `/top-rated`.
- Current state: local course data and embeddings are already present in the repo; static files are served directly by `main.py`.

## Key files
- `main.py` – FastAPI backend (CourseScout) with course recommendation system.
- `config.py` / `config.env` – configuration loading & validation (Python backend).
- `config.js` – client-side configuration provider for the frontend.
- `index.html`, `main.js`, `style.css`, `tailwind-config.js` – frontend UI and logic.
- `assets/` – images and media files (contains coursemate-icon.png).
- `process_data.py` – data preprocessing pipeline (creates embeddings and optimized datasets).
- `courses_data.feather` / `courses_data.csv` – 98,104 processed Udemy courses with metadata.
- `course_embeddings_float16.npy` – ML embeddings for course similarity (98K x 5K dimensions).
- `test_backend.py` – script to test backend endpoints and database connectivity.
- `setup.py` – configuration validation and initial setup tool.
- `requirements.txt` – backend dependencies.
- `README.md` – overview of the project, setup instructions, and feature description.

## Development workflow

1. Initial setup:
   ```bash
   # Clone repository and setup environment
   git clone <repo-url>
   cd CourseMate
   python -m venv .venv
   .venv\Scripts\Activate.ps1  # Windows
   pip install -r requirements.txt
   python setup.py  # Creates default config.env if missing
   ```

2. Start the server (in development mode):
   ```bash
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

3. Access the application:
   - Open http://127.0.0.1:8000 in your browser
   - The application is fully functional with the local dataset
   - For API docs, visit http://127.0.0.1:8000/docs

4. Making changes:
   - Backend (main.py): Changes are automatically applied with --reload
   - Frontend (index.html, main.js): Refresh the browser to see changes
   - Static files are served directly by FastAPI with explicit routes

