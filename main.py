"""
CourseMate - AI-Powered Course Recommendation System
FastAPI Backend Server

Author: Ajay Mathuriya
Institution: Minor in AI from IIT Ropar (iitrprai_24081389)

This backend server provides AI-powered course recommendations using:
- Content-based filtering with course similarity
- Real-time search with fuzzy matching
- Udemy API integration for course data
- Machine learning-based course recommendations
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response, RedirectResponse
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import requests
import logging
import asyncio
import aiohttp
from rapidfuzz import fuzz, process
import ftfy
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from fastapi import Body
import time
from functools import lru_cache
import os
from contextlib import asynccontextmanager
import json
import re

# Import configuration
from config import config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===========================================
# DATA MODELS
# ===========================================

class Category(BaseModel):
    name: str

class Instructor(BaseModel):
    name: str
    title: Optional[str] = None
    image_url: Optional[str] = None

class CourseOut(BaseModel):
    id: int
    title: str
    url: Optional[str] = None
    price: Optional[str] = None
    price_detail: Optional[Dict] = None
    is_paid: Optional[bool] = None
    visible_instructors: List[Instructor] = []
    image_480x270: Optional[str] = None
    image_750x422: Optional[str] = None
    published_time: Optional[str] = None
    instructional_level: Optional[str] = None
    content_info: Optional[str] = None
    content_length_practice_test_questions: Optional[int] = None
    num_subscribers: Optional[int] = None
    num_reviews: Optional[int] = None
    num_published_lectures: Optional[int] = None
    avg_rating: Optional[float] = None
    avg_rating_recent: Optional[float] = None
    rating: Optional[float] = None
    content_info_short: Optional[str] = None
    archive_time: Optional[str] = None
    has_closed_caption: Optional[bool] = None
    caption_languages: List[str] = []
    created: Optional[str] = None
    instructional_level_simple: Optional[str] = None
    last_update_date: Optional[str] = None
    locale: Optional[Dict] = None
    preview_url: Optional[str] = None
    curriculum_lectures: List[Dict] = []
    curriculum_items: List[Dict] = []
    headline: Optional[str] = None
    description: Optional[str] = None
    requirements: List[str] = []
    targets: List[str] = []
    primary_category: Optional[Category] = None
    primary_subcategory: Optional[Category] = None
    topic: Optional[Category] = None
    language: Optional[str] = None
    estimated_content_length: Optional[int] = None
    is_practice_test_course: Optional[bool] = None
    practice_test_course_id: Optional[int] = None
    relevancy_score: Optional[float] = None
    introduction_asset: Optional[Dict] = None
    curriculum_context: Optional[Dict] = None
    instructor_status: Optional[str] = None
    is_in_user_subscription: Optional[bool] = None
    features: List[str] = []

# ===========================================
# GLOBAL VARIABLES
# ===========================================
app = FastAPI(title="CourseScout API", description="AI-Powered Course Recommendation System")

# Mount static files
app.mount("/static", StaticFiles(directory="."), name="static")

# Serve individual static files
from fastapi.responses import FileResponse

@app.get("/style.css")
async def get_style_css():
    return FileResponse("style.css")

@app.get("/main.js")
async def get_main_js():
    return FileResponse("main.js")

@app.get("/config.js")
async def get_config_js():
    return FileResponse("config.js")

@app.get("/tailwind-config.js")
async def get_tailwind_config():
    return FileResponse("tailwind-config.js")

@app.get("/favicon.png")
async def get_favicon():
    return FileResponse("favicon.png")

@app.get("/assets/coursemate-icon.png")
async def get_coursemate_icon():
    return FileResponse("assets/coursemate-icon.png")

@app.get("/assets/{filename}")
async def get_asset(filename: str):
    return FileResponse(f"assets/{filename}")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Course data storage
courses_df = None
course_embeddings = None
tfidf_vectorizer = None
session_pool = None

# API Configuration
UDEMY_API_KEY = config.UDEMY_API_KEY
UDEMY_BASE_URL = config.UDEMY_BASE_URL
API_TIMEOUT = config.API_TIMEOUT_SEC

# Allowed hosts for image proxying to prevent SSRF
ALLOWED_IMAGE_HOSTS = {
    "udemycdn.com", "img-c.udemycdn.com", "img-b.udemycdn.com", "img-a.udemycdn.com",
    "learn.microsoft.com", "docs.microsoft.com",
    "images.unsplash.com", "i.imgur.com"
}

# ===========================================
# STARTUP AND SHUTDOWN EVENTS
# ===========================================

@app.on_event("startup")
async def startup_event():
    """Initialize the application"""
    global session_pool
    try:
        connector = aiohttp.TCPConnector(limit=100)
        timeout = aiohttp.ClientTimeout(total=API_TIMEOUT)
        session_pool = aiohttp.ClientSession(connector=connector, timeout=timeout)
        
        # Initialize course data
        await initialize_course_data()
        
        logger.info("CourseScout API started successfully")
    except Exception as e:
        logger.error(f"Startup error: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources"""
    global session_pool
    if session_pool:
        await session_pool.close()
    logger.info("CourseScout API shutdown completed")

# ===========================================
# CORE FUNCTIONS
# ===========================================

async def initialize_course_data():
    """Initialize course data and embeddings"""
    global courses_df, course_embeddings, tfidf_vectorizer

    try:
        # Determine dataset file from config or fallbacks
        data_file = getattr(config, 'COURSES_DATA_FILE', None)
        loaded = False

        if data_file and isinstance(data_file, str):
            try:
                # Try configured file (both absolute and relative paths)
                if os.path.exists(data_file):
                    if data_file.lower().endswith('.feather'):
                        courses_df = pd.read_feather(data_file)
                    elif data_file.lower().endswith('.csv'):
                        courses_df = pd.read_csv(data_file)
                    else:
                        logger.warning(f"Unsupported data file extension for {data_file}. Expected .feather or .csv")
                        courses_df = None
                    if courses_df is not None:
                        logger.info(f"Loaded {len(courses_df)} courses from configured file: {data_file}")
                        loaded = True
                else:
                    logger.info(f"Configured COURSES_DATA_FILE not found: {data_file}. Falling back to defaults.")
            except Exception as e:
                logger.warning(f"Failed loading configured COURSES_DATA_FILE ({data_file}): {e}. Falling back to defaults.")

        if not loaded:
            if os.path.exists("courses_data.feather"):
                courses_df = pd.read_feather("courses_data.feather")
                logger.info(f"Loaded {len(courses_df)} courses from courses_data.feather")
                loaded = True
            elif os.path.exists("courses_data.csv"):
                courses_df = pd.read_csv("courses_data.csv")
                logger.info(f"Loaded {len(courses_df)} courses from courses_data.csv")
                loaded = True

        if not loaded:
            logger.error("No course data file found. Set COURSES_DATA_FILE in config.env to an absolute path (e.g., C:\\Users\\<you>\\...\\courses_data.feather) or place courses_data.feather/csv in the repo root.")
            return

        # Load embeddings for similarity search
        emb_file = getattr(config, 'EMBEDDINGS_FILE', 'course_embeddings_float16.npy')
        try:
            # Try configured embeddings file first (both absolute and relative paths)
            if os.path.exists(emb_file):
                course_embeddings = np.load(emb_file)
                logger.info(f"Loaded embeddings from configured file: {emb_file} with shape {course_embeddings.shape}")
            elif os.path.exists('course_embeddings_float16.npy'):
                course_embeddings = np.load('course_embeddings_float16.npy')
                logger.info(f"Loaded embeddings from course_embeddings_float16.npy with shape {course_embeddings.shape}")
            else:
                course_embeddings = None
                logger.warning("No embeddings file found. Similarity-based recommendations will fall back to category-based.")
        except Exception as e:
            course_embeddings = None
            logger.warning(f"Failed to load embeddings: {e}. Continuing without embeddings.")

        # Prepare text search columns
        if 'title_clean' not in courses_df.columns:
            courses_df['title_clean'] = courses_df['title'].astype(str).str.lower().str.strip()

    except Exception as e:
        logger.error(f"Failed to load course data: {e}")
        courses_df = pd.DataFrame()
        course_embeddings = None

def normalize_text(text):
    """Normalize text for search and comparison"""
    if not isinstance(text, str):
        return ""
    return ftfy.fix_text(text).strip().lower()

async def fetch_udemy_courses(query: str = None, category: str = None, page: int = 1, page_size: int = 12):
    """Fetch courses from Udemy API"""
    try:
        url = f"{UDEMY_BASE_URL}/courses/"
        params = {
            "page": page,
            "page_size": page_size,
            "fields[course]": "@default,visible_instructors,image_480x270,estimated_content_length,num_subscribers,avg_rating_recent,content_info_short,objectives_summary"
        }
        
        if query:
            params["search"] = query
        if category:
            params["category"] = category
            
        headers = {
            "Authorization": f"Basic {UDEMY_API_KEY}",
            "Accept": "application/json"
        }
        
        if not session_pool:
            return []
            
        async with session_pool.get(url, params=params, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                return data.get("results", [])
            else:
                logger.error(f"Udemy API error: {response.status}")
                return []
                
    except Exception as e:
        logger.error(f"Error fetching Udemy courses: {e}")
        return []

def format_course_data(course_data: dict) -> dict:
    """Format course data from API response"""
    try:
        # Extract instructor names
        instructors = []
        for instructor in course_data.get("visible_instructors", []):
            instructors.append({
                "name": instructor.get("display_name", ""),
                "title": instructor.get("job_title", ""),
                "image_url": instructor.get("image_100x100", "")
            })
        
        # Format the course
        formatted_course = {
            "id": course_data.get("id"),
            "title": course_data.get("title", ""),
            "url": course_data.get("url", ""),
            "price": course_data.get("price", "Free"),
            "is_paid": course_data.get("is_paid", False),
            "visible_instructors": instructors,
            "image_480x270": course_data.get("image_480x270", ""),
            "image_750x422": course_data.get("image_750x422", ""),
            "published_time": course_data.get("published_time", ""),
            "instructional_level": course_data.get("instructional_level", ""),
            "content_info": course_data.get("content_info", ""),
            "num_subscribers": course_data.get("num_subscribers", 0),
            "num_reviews": course_data.get("num_reviews", 0),
            "avg_rating": course_data.get("avg_rating", 0),
            "avg_rating_recent": course_data.get("avg_rating_recent", 0),
            "rating": course_data.get("avg_rating", 0),  # Alias for compatibility
            "content_info_short": course_data.get("content_info_short", ""),
            "headline": course_data.get("headline", ""),
            "description": course_data.get("description", ""),
            "language": course_data.get("locale", {}).get("locale", "en"),
            "estimated_content_length": course_data.get("estimated_content_length", 0),
            "primary_category": {"name": course_data.get("primary_category", {}).get("title", "")},
            "primary_subcategory": {"name": course_data.get("primary_subcategory", {}).get("title", "")},
            "topic": {"name": course_data.get("topic", {}).get("title", "")}
        }
        
        return formatted_course
        
    except Exception as e:
        logger.error(f"Error formatting course data: {e}")
        return {}

def calculate_course_similarity(courses: List[dict]) -> np.ndarray:
    """Calculate similarity matrix for courses using TF-IDF"""
    try:
        # Create text features from course data
        course_texts = []
        for course in courses:
            text_features = []
            
            # Add title, description, category, etc.
            text_features.append(course.get("title", ""))
            text_features.append(course.get("description", ""))
            text_features.append(course.get("headline", ""))
            
            if course.get("primary_category", {}).get("name"):
                text_features.append(course["primary_category"]["name"])
            if course.get("primary_subcategory", {}).get("name"):
                text_features.append(course["primary_subcategory"]["name"])
            if course.get("topic", {}).get("name"):
                text_features.append(course["topic"]["name"])
                
            # Add instructor names
            for instructor in course.get("visible_instructors", []):
                text_features.append(instructor.get("name", ""))
            
            course_text = " ".join(filter(None, text_features))
            course_texts.append(normalize_text(course_text))
        
        if not course_texts:
            return np.array([])
        
        # Create TF-IDF vectors
        vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
        tfidf_matrix = vectorizer.fit_transform(course_texts)
        
        # Calculate cosine similarity
        similarity_matrix = cosine_similarity(tfidf_matrix)
        
        return similarity_matrix
        
    except Exception as e:
        logger.error(f"Error calculating course similarity: {e}")
        return np.array([])

# ===========================================
# API ENDPOINTS
# ===========================================

def _host_allowed(host: str) -> bool:
    try:
        host = host.lower()
    except Exception:
        return False
    for allowed in ALLOWED_IMAGE_HOSTS:
        if host == allowed or host.endswith("." + allowed):
            return True
    return False

@app.get("/image-proxy")
async def image_proxy(url: str = Query(..., description="Remote image URL to proxy")):
    """Lightweight image proxy to improve reliability and avoid hotlink issues.
    Only whitelisted hosts are allowed to mitigate SSRF risks.
    """
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc or not _host_allowed(parsed.hostname or ""):
            logger.warning(f"Blocked image proxy request to host: {parsed.hostname}")
            return RedirectResponse(url=config.FALLBACK_POSTER_URL, status_code=302)
        client = session_pool
        if not client:
            timeout = aiohttp.ClientTimeout(total=10)
            client = aiohttp.ClientSession(timeout=timeout)
            close_after = True
        else:
            close_after = False
        try:
headers_req = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Referer": "https://www.udemy.com/"
            }
            async with client.get(url, headers=headers_req) as resp:
                if resp.status == 200:
                    data = await resp.read()
                    content_type = resp.headers.get("Content-Type", "image/jpeg")
                    headers = {"Cache-Control": "public, max-age=86400"}
                    return Response(content=data, media_type=content_type, headers=headers)
                else:
                    logger.warning(f"Image proxy upstream status {resp.status} for {url}")
                    return RedirectResponse(url=config.FALLBACK_POSTER_URL, status_code=302)
        finally:
            if close_after:
                await client.close()
    except Exception as e:
        logger.exception(f"Image proxy error: {e}")
        return RedirectResponse(url=config.FALLBACK_POSTER_URL, status_code=302)

@app.get("/")
async def read_root():
    """Serve the frontend HTML"""
    return FileResponse('index.html')

@app.get("/api")
async def api_status():
    """API status endpoint"""
    return {
        "message": "CourseScout API is running!",
        "status": "healthy",
        "created_by": "Ajay Mathuriya, IIT Ropar"
    }

@app.get("/model/status")
async def get_model_status():
    """Get the status of the course recommendation system"""
    try:
        udemy_status = "configured" if UDEMY_API_KEY != "your_udemy_api_key_here" else "not_configured"
        
        return {
            "status": "success",
            "model_info": {
                "status": "ready",
                "type": "course_recommendation",
                "udemy_api": udemy_status,
                "message": "Course recommendation system ready"
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@app.get("/search")
async def search_courses(query: str = Query(...)):
    """Search for courses using local data"""
    try:
        logger.info(f"Searching for courses with query: {query}")
        
        if courses_df is None or courses_df.empty:
            logger.error("No course data available")
            return JSONResponse(content=[])
        
        query_lower = query.lower().strip()
        
        # Search in title, category, description, and instructor
        search_mask = (
            courses_df['title'].str.lower().str.contains(query_lower, na=False) |
            courses_df['category'].str.lower().str.contains(query_lower, na=False) |
            courses_df['description'].str.lower().str.contains(query_lower, na=False) |
            courses_df['instructor'].str.lower().str.contains(query_lower, na=False)
        )
        
        # Get search results
        search_results = courses_df[search_mask].copy()
        
        # Sort by rating and subscriber count
        search_results['score'] = (
            search_results['rating'] * 0.6 + 
            (search_results['num_subscribers'] / search_results['num_subscribers'].max()) * 0.4
        )
        
        search_results = search_results.sort_values('score', ascending=False).head(12)
        
        # Convert to list of dictionaries
        results = []
        for _, row in search_results.iterrows():
            course_dict = row.to_dict()
            # Convert numpy types to Python types
            for key, value in course_dict.items():
                if isinstance(value, (np.integer, np.floating)):
                    course_dict[key] = value.item()
                elif pd.isna(value):
                    course_dict[key] = None
            
            # Format for frontend
            formatted_course = {
                "id": course_dict["id"],
                "title": course_dict["title"],
                "visible_instructors": [{"name": course_dict["instructor"]}],
                "image_480x270": course_dict.get("image_url", ""),
                "price": course_dict["price"],
                "is_paid": course_dict["is_paid"],
                "avg_rating": course_dict["rating"],
                "rating": course_dict["rating"],
                "num_subscribers": course_dict["num_subscribers"],
                "num_reviews": course_dict["num_reviews"],
                "instructional_level": course_dict["level"],
                "headline": course_dict.get("headline", ""),
                "description": course_dict["description"],
                "primary_category": {"name": course_dict["category"]},
                "url": course_dict.get("url", "")
            }
            results.append(formatted_course)
        
        logger.info(f"Found {len(results)} courses for query: {query}")
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.exception(f"Error in /search endpoint: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/recommendations")
async def recommend_courses(
    course_id: int = Query(...),
    limit: int = Query(10, ge=1, le=50)
):
    """Get course recommendations based on a course ID using similarity"""
    try:
        logger.info(f"Getting recommendations for course ID: {course_id}")
        
        if courses_df is None or courses_df.empty:
            logger.error("No course data available")
            return JSONResponse(content=[])
        
        # Find the course in our dataset
        course_idx = courses_df[courses_df['id'] == course_id].index
        
        if len(course_idx) == 0:
            logger.warning(f"Course ID {course_id} not found")
            # Fallback to category-based recommendations
            random_courses = courses_df.sample(n=min(limit, len(courses_df))).copy()
        else:
            course_idx = course_idx[0]
            
            if course_embeddings is not None:
                # Use embeddings for similarity-based recommendations
                query_embedding = course_embeddings[course_idx].reshape(1, -1)
                similarities = cosine_similarity(query_embedding, course_embeddings)[0]
                
                # Get top similar courses (excluding the query course)
                similar_indices = similarities.argsort()[::-1]
                similar_indices = similar_indices[similar_indices != course_idx][:limit]
                
                recommendations = courses_df.iloc[similar_indices].copy()
            else:
                # Fallback: recommend from same category
                source_course = courses_df.iloc[course_idx]
                same_category = courses_df[
                    (courses_df['category'] == source_course['category']) & 
                    (courses_df['id'] != course_id)
                ]
                
                if len(same_category) > 0:
                    recommendations = same_category.sort_values('rating', ascending=False).head(limit)
                else:
                    recommendations = courses_df[courses_df['id'] != course_id].sample(n=min(limit, len(courses_df)-1))
        
            random_courses = recommendations
        
        # Format results for frontend
        results = []
        for _, row in random_courses.iterrows():
            course_dict = row.to_dict()
            # Convert numpy types to Python types
            for key, value in course_dict.items():
                if isinstance(value, (np.integer, np.floating)):
                    course_dict[key] = value.item()
                elif pd.isna(value):
                    course_dict[key] = None
            
            # Format for frontend
            formatted_course = {
                "id": course_dict["id"],
                "title": course_dict["title"],
                "visible_instructors": [{"name": course_dict["instructor"]}],
                "image_480x270": course_dict.get("image_url", ""),
                "price": course_dict["price"],
                "is_paid": course_dict["is_paid"],
                "avg_rating": course_dict["rating"],
                "rating": course_dict["rating"],
                "num_subscribers": course_dict["num_subscribers"],
                "num_reviews": course_dict["num_reviews"],
                "instructional_level": course_dict["level"],
                "headline": course_dict.get("headline", ""),
                "description": course_dict["description"],
                "primary_category": {"name": course_dict["category"]},
                "url": course_dict.get("url", "")
            }
            results.append(formatted_course)
        
        logger.info(f"Found {len(results)} recommendations for course {course_id}")
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.exception(f"Error in /recommendations endpoint: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/trending")
async def get_trending_courses(
    limit: int = Query(10, ge=1, le=50)
):
    """Get trending courses based on subscriber count"""
    try:
        logger.info("Fetching trending courses")
        
        if courses_df is None or courses_df.empty:
            logger.error("No course data available")
            return JSONResponse(content=[])
        
        # Sort by subscriber count (trending indicator)
        trending = courses_df.nlargest(limit, 'num_subscribers').copy()
        
        # Format results for frontend
        results = []
        for _, row in trending.iterrows():
            course_dict = row.to_dict()
            # Convert numpy types to Python types
            for key, value in course_dict.items():
                if isinstance(value, (np.integer, np.floating)):
                    course_dict[key] = value.item()
                elif pd.isna(value):
                    course_dict[key] = None
            
            # Format for frontend
            formatted_course = {
                "id": course_dict["id"],
                "title": course_dict["title"],
                "visible_instructors": [{"name": course_dict["instructor"]}],
                "image_480x270": course_dict.get("image_url", ""),
                "price": course_dict["price"],
                "is_paid": course_dict["is_paid"],
                "avg_rating": course_dict["rating"],
                "rating": course_dict["rating"],
                "num_subscribers": course_dict["num_subscribers"],
                "num_reviews": course_dict["num_reviews"],
                "instructional_level": course_dict["level"],
                "headline": course_dict.get("headline", ""),
                "description": course_dict["description"],
                "primary_category": {"name": course_dict["category"]},
                "url": course_dict.get("url", "")
            }
            results.append(formatted_course)
        
        logger.info(f"Found {len(results)} trending courses")
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.exception(f"Error in /trending endpoint: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/top-rated")
async def get_top_rated_courses(
    limit: int = Query(10, ge=1, le=50)
):
    """Get top-rated courses based on rating"""
    try:
        logger.info("Fetching top-rated courses")
        
        if courses_df is None or courses_df.empty:
            logger.error("No course data available")
            return JSONResponse(content=[])
        
        # Filter courses with decent number of reviews and sort by rating
        top_rated = courses_df[
            (courses_df['rating'] >= 4.0) & 
            (courses_df['num_reviews'] >= 10)
        ].nlargest(limit, 'rating').copy()
        
        # If not enough highly rated courses, fallback to all courses sorted by rating
        if len(top_rated) < limit:
            top_rated = courses_df.nlargest(limit, 'rating').copy()
        
        # Format results for frontend
        results = []
        for _, row in top_rated.iterrows():
            course_dict = row.to_dict()
            # Convert numpy types to Python types
            for key, value in course_dict.items():
                if isinstance(value, (np.integer, np.floating)):
                    course_dict[key] = value.item()
                elif pd.isna(value):
                    course_dict[key] = None
            
            # Format for frontend
            formatted_course = {
                "id": course_dict["id"],
                "title": course_dict["title"],
                "visible_instructors": [{"name": course_dict["instructor"]}],
                "image_480x270": course_dict.get("image_url", ""),
                "price": course_dict["price"],
                "is_paid": course_dict["is_paid"],
                "avg_rating": course_dict["rating"],
                "rating": course_dict["rating"],
                "num_subscribers": course_dict["num_subscribers"],
                "num_reviews": course_dict["num_reviews"],
                "instructional_level": course_dict["level"],
                "headline": course_dict.get("headline", ""),
                "description": course_dict["description"],
                "primary_category": {"name": course_dict["category"]},
                "url": course_dict.get("url", "")
            }
            results.append(formatted_course)
        
        logger.info(f"Found {len(results)} top-rated courses")
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.exception(f"Error in /top-rated endpoint: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/recommendations/user")
async def recommend_for_user(payload: dict = Body(...)):
    """Get personalized course recommendations based on user preferences"""
    try:
        logger.info("Generating personalized course recommendations")
        
        # Extract user preferences
        interests = payload.get("interests", [])
        skill_level = payload.get("skill_level", "beginner")
        language = payload.get("language", ["en"])
        budget = payload.get("budget", "any")
        
        # Build search query based on interests
        search_query = " ".join(interests) if interests else "programming"
        
        # Fetch courses based on interests
        course_results = await fetch_udemy_courses(query=search_query, page_size=20)
        
        # Format and filter results
        formatted_courses = []
        for course in course_results:
            formatted_course = format_course_data(course)
            if formatted_course:
                # Apply filters
                course_level = formatted_course.get("instructional_level", "").lower()
                
                # Filter by skill level
                if skill_level == "beginner" and "advanced" in course_level:
                    continue
                elif skill_level == "advanced" and "beginner" in course_level:
                    continue
                
                # Filter by budget
                if budget == "free" and formatted_course.get("is_paid", False):
                    continue
                
                formatted_courses.append(formatted_course)
        
        # Sort by rating and subscriber count
        formatted_courses.sort(
            key=lambda x: (x.get("avg_rating", 0) * 0.7 + 
                          min(x.get("num_subscribers", 0) / 10000, 1) * 0.3), 
            reverse=True
        )
        
        # Return top 10
        result = formatted_courses[:10]
        
        logger.info(f"Generated {len(result)} personalized recommendations")
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.exception(f"Error in /recommendations/user endpoint: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/categories")
async def get_categories():
    """Get available course categories"""
    try:
        # Return common programming and tech categories
        categories = [
            {"id": "programming", "name": "Programming", "icon": "code"},
            {"id": "web-development", "name": "Web Development", "icon": "globe"},
            {"id": "mobile-development", "name": "Mobile Development", "icon": "smartphone"},
            {"id": "data-science", "name": "Data Science", "icon": "bar-chart"},
            {"id": "machine-learning", "name": "Machine Learning", "icon": "cpu"},
            {"id": "artificial-intelligence", "name": "AI", "icon": "brain"},
            {"id": "cybersecurity", "name": "Cybersecurity", "icon": "shield"},
            {"id": "cloud-computing", "name": "Cloud Computing", "icon": "cloud"},
            {"id": "devops", "name": "DevOps", "icon": "server"},
            {"id": "databases", "name": "Databases", "icon": "database"}
        ]
        
        return JSONResponse(content=categories)
        
    except Exception as e:
        logger.exception(f"Error in /categories endpoint: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# ===========================================
# MAIN APPLICATION
# ===========================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)