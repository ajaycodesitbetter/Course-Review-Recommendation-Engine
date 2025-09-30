# CourseScout - Product Requirements Document

## Project Overview
**CourseScout** is an AI-powered course recommendation system with 98,104+ courses from Udemy, providing intelligent course discovery and recommendations.

**Author:** Ajay Mathuriya  
**Institution:** Minor in AI from IIT Ropar

## Key Features

### 1. Course Search API (`/search`)
- Search across 98K+ courses with fuzzy matching
- Search by title, category, description, and instructor
- Intelligent scoring and ranking
- Returns up to 12 relevant results

### 2. AI Course Recommendations (`/recommendations`) 
- ML-based recommendations using TF-IDF and cosine similarity
- 5000-dimension vectors for accurate course matching
- Fallback to category-based recommendations
- Returns 10 similar courses for any course ID

### 3. Trending Courses (`/trending`)
- Sort courses by subscriber count (popularity)
- Real-time trending analysis
- Returns top 10 trending courses with metadata

### 4. Top Rated Courses (`/top-rated`)
- Quality filtering (rating >= 4.0, reviews >= 10)
- Sort by highest ratings
- Returns top 10 rated courses

### 5. Frontend Course Browser (`/`)
- Interactive web interface with search
- Horizontal scrolling course carousels
- Course detail modals with recommendations
- Watchlist functionality
- User profile and preferences

### 6. Static Asset Serving
- Serves HTML, CSS, JS files
- Course images with fallback handling
- Optimized asset delivery

## Technical Specifications

### Backend
- **Framework:** FastAPI (Python)
- **Server:** Uvicorn on port 8000
- **Data:** 98,104 courses in pandas DataFrames
- **ML Model:** TF-IDF vectors with cosine similarity
- **APIs:** RESTful endpoints with OpenAPI docs

### Frontend  
- **Framework:** Vanilla JavaScript ES6+
- **Styling:** Tailwind CSS (CDN)
- **Icons:** Lucide Icons
- **Build:** No bundler required

## API Endpoints to Test

1. `GET /api` - Health check
2. `GET /search?query=python` - Course search
3. `GET /trending` - Trending courses
4. `GET /top-rated` - Top rated courses  
5. `GET /recommendations?course_id=567828` - AI recommendations
6. `GET /` - Frontend application
7. `GET /style.css` - CSS styles
8. `GET /main.js` - JavaScript application

## Success Criteria

- All API endpoints return 200 status codes
- Search returns relevant results within 2 seconds
- Recommendations are contextually similar
- Frontend loads without errors
- Course images display with proper fallbacks
- No broken links or missing assets

## Data Quality Requirements

- Course data includes: title, instructor, rating, price, description
- Images load properly with fallback for missing images
- Search handles typos and partial matches
- Recommendations are diverse and relevant