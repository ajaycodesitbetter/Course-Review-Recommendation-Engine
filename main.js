/**
 * CourseScout - AI-Powered Course Recommendation System
 * Frontend JavaScript Application
 * 
 * Author: Ajay Mathuriya
 * Institution: Minor in AI from IIT Ropar (iitrprai_24081389)
 * 
 * This file contains the complete frontend logic for the CourseScout application,
 * including user interface interactions, API calls, and data management.
 */

// ===========================================
// CONFIGURATION & CONSTANTS
// ===========================================
// Configuration is loaded from config.js
const UDEMY_API_KEY = config.UDEMY_API_KEY;
const UDEMY_BASE_URL = config.UDEMY_BASE_URL;
const IMAGE_BASE_URL = config.IMAGE_BASE_URL;
const FALLBACK_POSTER_URL = config.FALLBACK_POSTER_URL;
const COURSE_LINK_BASE = config.COURSE_LINK_BASE;

const LANGUAGE_MAP = {
    'en': { name: 'English', flag: '🇺🇸' },
    'hi': { name: 'Hindi', flag: '🇮🇳' },
    'es': { name: 'Spanish', flag: '🇪🇸' },
    'fr': { name: 'French', flag: '🇫🇷' },
    'de': { name: 'German', flag: '🇩🇪' },
    'ja': { name: 'Japanese', flag: '🇯🇵' },
    'ko': { name: 'Korean', flag: '🇰🇷' },
    'pt': { name: 'Portuguese', flag: '🇵🇹' },
    'it': { name: 'Italian', flag: '🇮🇹' },
    'ru': { name: 'Russian', flag: '🇷🇺' }
};

// ===========================================
// STATE MANAGEMENT
// ===========================================
let userProfile = {
    user_id: Date.now().toString(),
    name: 'User',
    age: 25,
    safe_mode: true,
    language: ['en'],
    mood: 'happy',
    region: 'US',
    watchlist: [],
    history: [],
    liked_courses: [],
    disliked_courses: [],
    profile_pic: null,
    last_mood_update: null,
    timestamp: new Date()
};

let watchlist = [];
let genreMap = {};
let languages = {};
let trendingPage = 1;
let topRatedPage = 1;
// Caching for optimization
let CACHE_TTL_MS = 30000; // 30 seconds for faster suggestions (reduced from 60s)
let searchResultCache = new Map();
let suggestionCache = new Map();
let tmdbPosterCache = new Map(); // id -> poster_path/backdrop/absolute


// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    try {
        lucide.createIcons();
        initializeApp();
    } catch (error) {
        console.error('Error during initialization:', error);
        // Show error message to user
        showToast('Failed to initialize application. Please refresh the page.', 'error');
    }
});

function initializeApp() {
    try {
        loadUserProfile();
        detectUserLocation();
        getGenres();
        getLanguages();
        setupEventListeners();
        setupLanguageSelector();
        setupHorizontalScroll();
        setupAccessibility();
        loadInitialData();
        checkMoodUpdate();
        updateUI();
    } catch (error) {
        console.error('Error in initializeApp:', error);
        showToast('Some features may not work properly. Please refresh the page.', 'warning');
    }
}

// ===========================================
// USER PROFILE MANAGEMENT
// ===========================================
function loadUserProfile() {
    const saved = localStorage.getItem('CourseScoutProfile');
    if (saved) {
        userProfile = { ...userProfile, ...JSON.parse(saved) };
    }
    watchlist = userProfile.watchlist || [];
}

function saveUserProfile() {
    userProfile.timestamp = new Date();
    localStorage.setItem('CourseScoutProfile', JSON.stringify(userProfile));
}

async function detectUserLocation() {
    try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const language = navigator.language || navigator.userLanguage;
        
        if (!localStorage.getItem('CourseMateProfile')) {
            userProfile.language = [language.split('-')[0]];
            userProfile.region = language.split('-')[1] || 'US';
        }
    } catch (error) {
        console.log('Could not detect location, using defaults');
    }
}

function updateUI() {
    document.getElementById('profile-pic').src = userProfile.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name)}&background=ff6b35&color=fff`;
    updateWatchlistCount();
    populateProfileForm();
}

function populateProfileForm() {
    document.getElementById('profile-name-input').value = userProfile.name;
    document.getElementById('profile-age-input').value = userProfile.age;
    document.getElementById('profile-region-input').value = userProfile.region;
    document.getElementById('safe-mode-input').checked = userProfile.safe_mode;
    document.getElementById('profile-pic-large').src = userProfile.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name)}&background=ff6b35&color=fff`;
    
    // Set languages
    const langSelect = document.getElementById('profile-languages-input');
    Array.from(langSelect.options).forEach(option => {
        option.selected = userProfile.language.includes(option.value);
    });
    
    // Update custom language options
    document.querySelectorAll('.language-option').forEach(option => {
        if (userProfile.language.includes(option.dataset.lang)) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
    
    updateLanguageBadges();
    updateMoodSelection();
}

// ===========================================
// TOAST NOTIFICATIONS
// ===========================================
function showToast(message, type = 'success') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
        success: 'check-circle',
        warning: 'alert-triangle',
        error: 'x-circle'
    };

    toast.innerHTML = `
        <i data-lucide="${iconMap[type] || 'info'}" class="w-5 h-5 flex-shrink-0"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.parentNode?.removeChild(toast), 300);
    }, 3000);
}

// ===========================================
// LANGUAGE MANAGEMENT
// ===========================================
function updateLanguageBadges() {
    const langSelect = document.getElementById('profile-languages-input');
    const badgesContainer = document.getElementById('language-badges');
    
    if (!langSelect || !badgesContainer) return;

    const selectedLanguages = Array.from(langSelect.selectedOptions).map(option => option.value);
    
    badgesContainer.innerHTML = selectedLanguages.map(langCode => {
        const langInfo = LANGUAGE_MAP[langCode] || { name: langCode, flag: '' };
        return `
            <div class="language-badge">
                <span class="mr-1">${langInfo.flag}</span>
                ${langInfo.name}
                <span class="remove-btn" onclick="removeLanguage('${langCode}')" title="Remove ${langInfo.name}">
                    ×
                </span>
            </div>
        `;
    }).join('');
}

function removeLanguage(langCode) {
    const langSelect = document.getElementById('profile-languages-input');
    const languageOption = document.querySelector(`[data-lang="${langCode}"]`);
    const option = langSelect.querySelector(`option[value="${langCode}"]`);
    
    if (option) {
        option.selected = false;
        languageOption?.classList.remove('selected');
        updateLanguageBadges();
    }
}

function setupLanguageSelector() {
    const languageOptions = document.querySelectorAll('.language-option');
    const langSelect = document.getElementById('profile-languages-input');
    
    languageOptions.forEach(option => {
        option.addEventListener('click', () => {
            const langCode = option.dataset.lang;
            const selectOption = langSelect.querySelector(`option[value="${langCode}"]`);
            
            if (selectOption) {
                if (option.classList.contains('selected')) {
                    option.classList.remove('selected');
                    selectOption.selected = false;
                } else {
                    option.classList.add('selected');
                    selectOption.selected = true;
                }
                updateLanguageBadges();
                
                // Update user profile language preferences
                userProfile.language = Array.from(langSelect.selectedOptions).map(opt => opt.value);
                saveUserProfile();
                
                // Refresh recommendations based on new language preferences
                loadPersonalizedRecommendations();
            }
        });
    });
}

// ===========================================
// MOOD MANAGEMENT
// ===========================================
function updateMoodSelection() {
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.mood === userProfile.mood) {
            btn.classList.add('selected');
        }
    });
}

function checkMoodUpdate() {
    const lastUpdate = userProfile.last_mood_update;
    const oneHour = 60 * 60 * 1000;
    
    if (!lastUpdate || (Date.now() - new Date(lastUpdate).getTime()) > oneHour) {
        setTimeout(() => {
            document.getElementById('mood-popup').classList.remove('hidden');
        }, 2000);
    }
}

// ===========================================
// API FUNCTIONS
// ===========================================
function buildApiUrl(endpoint, page = 1, additionalParams = {}) {
    const baseUrl = config.BACKEND_BASE_URL;
    const params = new URLSearchParams();
    
    // Add common filters
    if (userProfile.safe_mode) {
        params.set('safe_mode', 'true');
    }
    
    if (userProfile.language && userProfile.language.length > 0) {
        params.set('languages', userProfile.language.join(','));
    }
    
    params.set('limit', '10');
    
    // Add any additional parameters
    Object.entries(additionalParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            params.set(key, value);
        }
    });
    
    return `${baseUrl}/${endpoint}?${params.toString()}`;
}

async function fetchMovies(endpoint, page = 1, filters = {}) {
    const fetchWithTimeout = async (url, options = {}, timeoutMs = 7000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return res;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    };

    try {
        let apiUrl;
        let useBackend = false;

        if (endpoint === 'trending/movie/day') {
            // Try backend first
            apiUrl = buildApiUrl('trending', page, filters);
            useBackend = true;
        } else if (endpoint === 'movie/top_rated') {
            // Try backend first
            apiUrl = buildApiUrl('top-rated', page, filters);
            useBackend = true;
        } else {
            // Direct TMDB for other endpoints
            apiUrl = `${TMDB_BASE_URL}/${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&page=${page}&region=${userProfile.region}`;
        }

        let response;
        try {
            response = await fetchWithTimeout(apiUrl, {}, 7000);
        } catch (e) {
            // If backend timed out or failed, fall back to TMDB for known categories
            if (useBackend) {
                const fallbackMap = {
                    'trending/movie/day': `${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}&language=en-US&page=${page}&region=${userProfile.region}`,
                    'movie/top_rated': `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=${page}&region=${userProfile.region}`
                };
                const fallbackUrl = fallbackMap[endpoint];
                if (fallbackUrl) {
                    try {
                        response = await fetchWithTimeout(fallbackUrl, {}, 7000);
                    } catch (fallbackErr) {
                        console.error('Both backend and TMDB fallback failed:', fallbackErr);
                        return [];
                    }
                } else {
                    return [];
                }
            } else {
                console.error('Fetch failed:', e);
                return [];
            }
        }

        if (!response || !response.ok) {
            // Non-OK status: attempt fallback for backend endpoints
            if (useBackend) {
                const fallbackMap = {
                    'trending/movie/day': `${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}&language=en-US&page=${page}&region=${userProfile.region}`,
                    'movie/top_rated': `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=${page}&region=${userProfile.region}`
                };
                const fallbackUrl = fallbackMap[endpoint];
                if (fallbackUrl) {
                    try {
                        const fbRes = await fetchWithTimeout(fallbackUrl, {}, 7000);
                        const fbData = await fbRes.json();
                        return Array.isArray(fbData) ? fbData : fbData.results || [];
                    } catch (fbErr) {
                        console.error('Fallback fetch failed:', fbErr);
                        return [];
                    }
                }
            }
            return [];
        }

        const data = await response.json();
        return Array.isArray(data) ? data : data.results || [];
    } catch (error) {
        console.error('Error fetching movies:', error);
        return [];
    }
}

async function fetchPersonalizedRecommendations() {
    try {
        const response = await fetch(`${config.BACKEND_BASE_URL}/recommendations/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mood: userProfile.mood,
                language: userProfile.language || ['en'],
                liked_movies: userProfile.liked_movies || [],
                disliked_movies: userProfile.disliked_movies || [],
                watchlist: userProfile.watchlist.map(m => m.id || m) || []
            })
        });

        if (response.ok) {
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        }
        return [];
    } catch (error) {
        console.error('Error fetching personalized recommendations:', error);
        return [];
    }
}

function getGenres() {
    // Use predefined genre list that matches our LightFM model
    const predefinedGenres = [
        'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 
        'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 
        'Mystery', 'Romance', 'Science Fiction', 'TV Movie', 'Thriller', 'War', 'Western'
    ];
    
    // Create a simple mapping for filtering
    genreMap = {};
    predefinedGenres.forEach((genre, index) => {
        genreMap[genre.toLowerCase()] = genre;
    });
    
    populateGenreFilter();
}

async function getLanguages() {
    try {
        const response = await fetch(`${TMDB_BASE_URL}/configuration/languages?api_key=${TMDB_API_KEY}`);
        const data = await response.json();
        languages = data.reduce((acc, lang) => {
            acc[lang.iso_639_1] = lang.english_name;
            return acc;
        }, {});
        populateLanguageFilter();
    } catch (error) {
        console.error('Error fetching languages:', error);
    }
}

async function getTrailer(movieId) {
    try {
        const response = await fetch(`${TMDB_BASE_URL}/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`);
        const data = await response.json();
        const trailer = data.results.find(video => video.site === "YouTube" && video.type === "Trailer");
        return trailer ? `${YOUTUBE_BASE_URL}${trailer.key}` : null;
    } catch (error) {
        console.error('Error fetching trailer:', error);
        return null;
    }
}

async function getRecommendations(movieId) {
    try {
        const params = new URLSearchParams();
        params.set('movie_id', movieId);
        
        // Add user filters
        if (userProfile.safe_mode) {
            params.set('safe_mode', 'true');
        }
        
        if (userProfile.language && userProfile.language.length > 0) {
            params.set('languages', userProfile.language.join(','));
        }
        
        params.set('limit', '10');
        
        const response = await fetch(`${config.BACKEND_BASE_URL}/recommendations?${params.toString()}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return [];
    }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================
function getCourseImageUrl(course) {
    if (!course || typeof course !== 'object') return FALLBACK_POSTER_URL;
    
    const candidates = [
        course.image_480x270,
        course.image_750x422,
        course.image_url,
        course.thumbnail,
        course.poster_url
    ];
    
    for (const candidate of candidates) {
        if (!candidate) continue;
        const raw = String(candidate).trim();
        if (!raw || raw === 'null' || raw === 'None' || raw === 'undefined' || raw.toLowerCase() === 'nan') continue;
        if (raw.startsWith('data:image')) return raw;
        if (raw.startsWith('http')) return raw;
        if (raw.startsWith('//')) return `https:${raw}`;
        return raw;
    }
    return FALLBACK_POSTER_URL;
}

function movieNeedsPoster(movie) {
    if (!movie) return true;
    const fields = [
        movie.poster_path,
        movie.poster,
        movie.posterUrl,
        movie.poster_url,
        movie.image_url,
        movie.image,
        movie.poster_path_hq,
        movie.backdrop_path
    ];
    return !fields.some(v => v && String(v).trim() && String(v).trim() !== 'null');
}

async function enrichMoviePosters(movies) {
    try {
        const toFix = movies.filter(m => movieNeedsPoster(m) && m && m.id);
        if (toFix.length === 0) return;

        // Limit network load
        const limited = toFix.slice(0, 6);
        const fetches = limited.map(async (m) => {
            if (tmdbPosterCache.has(m.id)) {
                const cached = tmdbPosterCache.get(m.id);
                if (cached) {
                    if (!m.poster_path && cached.poster_path) m.poster_path = cached.poster_path;
                    if (!m.backdrop_path && cached.backdrop_path) m.backdrop_path = cached.backdrop_path;
                }
                return;
            }
            try {
                const resp = await fetch(`${TMDB_BASE_URL}/movie/${m.id}?api_key=${TMDB_API_KEY}&language=en-US`);
                if (!resp.ok) return;
                const data = await resp.json();
                tmdbPosterCache.set(m.id, { poster_path: data.poster_path, backdrop_path: data.backdrop_path });
                if (!m.poster_path && data.poster_path) m.poster_path = data.poster_path;
                if (!m.backdrop_path && data.backdrop_path) m.backdrop_path = data.backdrop_path;
                if (!m.title && data.title) m.title = data.title;
            } catch (e) {
                // ignore
            }
        });
        await Promise.all(fetches);
    } catch (e) {
        // ignore enrichment errors
    }
}

function populateGenreFilter() { /* filters removed */ }

function populateLanguageFilter() { /* filters removed */ }

// ===========================================
// MOVIE CARD FUNCTIONS
// ===========================================
function createCourseCard(course, showTrendingNumber = false, trendingIndex = 0) {
    const isInWatchlist = watchlist.some(item => item.id === course.id);
    const shouldEagerLoad = trendingIndex < 4;
    
    // Get instructor names
    const instructors = course.visible_instructors || [];
    const instructorNames = instructors.slice(0, 2).map(inst => inst.name || inst.display_name).join(', ');
    
    // Get category/topic
    const category = course.primary_category?.name || course.topic?.name || course.primary_subcategory?.name || '';
    
    return `
        <div class="movie-card bg-gray-800/30 rounded-2xl p-4 hover:bg-gray-800/50 transition-all group relative flex flex-col h-full">
            ${showTrendingNumber ? `<div class="trending-number">${trendingIndex + 1}</div>` : ''}
            <div class="poster-container aspect-[16/9] w-full rounded-xl overflow-hidden mb-4 relative">
                ${course.is_paid === false ? `<div class="free-badge">FREE</div>` : ''}
                <img src="${getCourseImageUrl(course)}" alt="${course.title}" ${shouldEagerLoad ? 'loading="eager"' : 'loading="lazy"'} 
                     onerror="this.onerror=null;this.src='https://dummyimage.com/480x270/1f2937/9ca3af&text=No+Image';" 
                     data-course-id="${course.id}"
                     class="w-full h-full object-cover rounded-xl transition-transform group-hover:scale-110" />
                <button class="poster-details-btn" onclick="showCourseDetail(${course.id})">
                    <i data-lucide="info" class="w-5 h-5"></i>
                </button>
            </div>
            <h3 class="font-semibold text-sm mb-2 line-clamp-2 cursor-pointer" title="${course.title}" onclick="showCourseDetail(${course.id})">${course.title}</h3>
            <div class="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span class="flex items-center">
                    <i data-lucide="star" class="w-3 h-3 mr-1 text-yellow-400"></i>
                    ${course.avg_rating || course.rating ? (course.avg_rating || course.rating).toFixed(1) : 'N/A'}
                </span>
                <span class="flex items-center">
                    <i data-lucide="users" class="w-3 h-3 mr-1"></i>
                    ${course.num_subscribers ? (course.num_subscribers > 1000 ? (course.num_subscribers/1000).toFixed(1) + 'K' : course.num_subscribers) : '0'}
                </span>
            </div>
            ${instructorNames ? `<p class="text-xs text-gray-400 mb-3">By ${instructorNames}</p>` : ''}
            ${category ? `<div class="mb-3">
                <span class="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">${category}</span>
            </div>` : ''}
            <div class="space-y-2 mt-auto">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-orange-400">
                        ${course.price || (course.is_paid === false ? 'Free' : 'Paid')}
                    </span>
                    <span class="text-xs text-gray-400">
                        ${course.instructional_level || course.level || 'All levels'}
                    </span>
                </div>
                <button data-course-id="${course.id}" onclick="toggleWatchlist(${JSON.stringify(course).replace(/"/g, '&quot;')})" 
                        class="watchlist-btn w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                            isInWatchlist 
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'bg-orange-600 hover:bg-orange-700 text-white'
                        }">
                    <i data-lucide="${isInWatchlist ? 'check' : 'plus'}" class="w-4 h-4 mr-2"></i>
                    ${isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                </button>
            </div>
        </div>
    `;
}

// ===========================================
// COURSE DETAIL FUNCTIONS
// ===========================================
async function showCourseDetail(courseId) {
    const modal = document.getElementById('course-modal');
    const content = document.getElementById('course-detail-content');

    try {
        addToHistory(courseId);

        // First try to find the course in our local data or cache
        let course = null;
        const searchParams = new URLSearchParams();
        searchParams.set('course_id', courseId);
        
        // Search for the course by ID (backend may not expose /course/{id})
        const searchResponse = await fetch(`${config.BACKEND_BASE_URL}/search?query=id:${courseId}&limit=1`);
        if (searchResponse.ok) {
            const searchResults = await searchResponse.json();
            if (searchResults.length > 0) {
                course = searchResults[0];
            }
        }

        if (!course) {
            showToast('Course details not found.', 'error');
            return;
        }

        const isInWatchlist = watchlist.some(item => item.id === course.id);
        const instructors = course.visible_instructors || [];
        const instructorNames = instructors.map(inst => inst.name || inst.display_name).join(', ');
        const category = course.primary_category?.name || course.topic?.name || course.primary_subcategory?.name || 'Unknown';

        content.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-2xl font-bold line-clamp-2">${course.title}</h2>
                <button onclick="closeCourseModal()" class="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="grid md:grid-cols-4 gap-6">
                <div class="md:col-span-1">
                    ${course.is_paid === false ? `<div class="free-badge">FREE</div>` : ''}
                    <img src="${getCourseImageUrl(course)}" alt="${course.title}" class="w-full rounded-xl shadow-lg mb-4">
                    ${course.url ? `
                        <a href="${course.url}" target="_blank" class="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white flex items-center justify-center transition-colors mb-3">
                            <i data-lucide="external-link" class="w-4 h-4 mr-2"></i>
                            View Course
                        </a>
                    ` : ''}
                </div>
                <div class="md:col-span-3 flex flex-col">
                    <div class="flex items-center gap-4 mb-4">
                        <span class="flex items-center text-yellow-400">
                            <i data-lucide="star" class="w-4 h-4 mr-1"></i>
                            ${course.avg_rating || course.rating ? (course.avg_rating || course.rating).toFixed(1) : 'N/A'}
                        </span>
                        <span class="text-gray-400">${course.instructional_level || course.level || 'All levels'}</span>
                        <span class="text-gray-400">${course.num_subscribers ? (course.num_subscribers > 1000 ? (course.num_subscribers/1000).toFixed(1) + 'K' : course.num_subscribers) + ' students' : ''}</span>
                    </div>
                    <div class="flex flex-wrap gap-2 mb-4">
                        <span class="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full">${category}</span>
                        <span class="px-3 py-1 bg-orange-500/20 text-orange-300 text-sm rounded-full">${course.price || (course.is_paid === false ? 'Free' : 'Paid')}</span>
                        ${course.language ? `<span class="px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">${course.language}</span>` : ''}
                    </div>
                    ${instructorNames ? `<div class="mb-4">
                        <strong class="text-gray-300">Instructor(s):</strong>
                        <span class="text-gray-400 ml-2">${instructorNames}</span>
                    </div>` : ''}
                    <p class="text-gray-300 mb-6">${course.description || course.headline || 'No description available.'}</p>
                    <div class="flex flex-wrap gap-3 mb-6">
                        <button data-course-id="${course.id}" onclick="toggleWatchlist(${JSON.stringify(course).replace(/"/g, '&quot;')})" 
                                class="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg text-white flex items-center transition-colors">
                            <i data-lucide="bookmark" class="w-4 h-4 mr-2"></i>
                            ${isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                        </button>
                        <button onclick="rateCourse(${course.id}, true); updateRatingButtons(${course.id})" 
                                id="like-btn-${course.id}" class="rating-btn px-4 py-2 rounded-lg flex items-center transition-colors bg-gray-700 hover:bg-gray-600 text-gray-300">
                            <i data-lucide="thumbs-up" class="w-4 h-4"></i>
                        </button>
                        <button onclick="rateCourse(${course.id}, false); updateRatingButtons(${course.id})" 
                                id="dislike-btn-${course.id}" class="rating-btn px-4 py-2 rounded-lg flex items-center transition-colors bg-gray-700 hover:bg-gray-600 text-gray-300">
                            <i data-lucide="thumbs-down" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div id="course-recommendations-section" class="mt-10">
                <div class="section-navigation">
                    <h3 class="text-xl font-bold mb-4 flex items-center">
                        <i data-lucide="target" class="w-5 h-5 mr-2 text-green-400"></i>
                        Similar Courses
                    </h3>
                </div>
                <div class="horizontal-scroll scrollbar-hide pb-4">
                    <div id="course-recommendations" class="flex gap-6">
                        <div class="text-center py-8 text-gray-400 min-w-full">
                            <svg class="animate-spin h-6 w-6 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                            <p class="text-sm">Loading recommendations...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
        lucide.createIcons();
        
        // Load course recommendations
        try {
            const recResponse = await fetch(`${config.BACKEND_BASE_URL}/recommendations?course_id=${course.id}&limit=8`);
            if (recResponse.ok) {
                const recommendations = await recResponse.json();
                if (recommendations.length > 0) {
                    await displayCourses(recommendations, 'course-recommendations');
                } else {
                    document.getElementById('course-recommendations').innerHTML = '<p class="text-gray-400 text-center min-w-full">No similar courses found.</p>';
                }
            }
        } catch (recError) {
            console.warn('Failed to load course recommendations:', recError);
            document.getElementById('course-recommendations').innerHTML = '<p class="text-gray-400 text-center min-w-full">Failed to load similar courses.</p>';
        }
        
    } catch (error) {
        console.error('Error showing course detail:', error);
        showToast('Failed to load course details.', 'error');
    }
}

function closeCourseModal() {
    document.getElementById('course-modal').classList.add('hidden');
}

// ===========================================
// MOVIE DETAIL FUNCTIONS
// ===========================================
async function showMovieDetail(movieId) {
    const modal = document.getElementById('movie-modal');
    const content = document.getElementById('movie-detail-content');

    try {
        addToHistory(movieId);

        const response = await fetch(`${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`);
        const movie = await response.json();
        const trailerUrl = await getTrailer(movieId);

        const isLiked = userProfile.liked_movies.includes(movieId);
        const isDisliked = userProfile.disliked_movies.includes(movieId);
        const isInWatchlist = watchlist.some(item => item.id === movie.id);

        content.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-2xl font-bold line-clamp-2">${movie.title}</h2>
                <button onclick="closeMovieModal()" class="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="grid md:grid-cols-4 gap-6">
                <div class="md:col-span-1">
                    ${movie.adult ? `<div class=\"adult-badge\">18+</div>` : ''}
                    <img src="${getMoviePoster(movie)}" alt="${movie.title}" class="w-full rounded-xl shadow-lg mb-4 ${movie.adult ? 'poster-blur' : ''}">
                </div>
                <div class="md:col-span-3 flex flex-col">
                    <div class="flex items-center gap-4 mb-4">
                        <span class="flex items-center text-yellow-400">
                            <i data-lucide="star" class="w-4 h-4 mr-1"></i>
                            ${movie.vote_average && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : 'N/A'}
                        </span>
                        <span class="text-gray-400">${movie.release_date ?? ''}</span>
                        <span class="text-gray-400">${movie.runtime ? movie.runtime + ' min' : 'N/A'}</span>
                    </div>
                    <div class="flex flex-wrap gap-2 mb-4">
                        ${movie.genres.map(genre => `<span class="px-3 py-1 bg-orange-500/20 text-orange-300 text-sm rounded-full">${genre.name}</span>`).join('')}
                    </div>
                    <div class="mb-4">
                        <strong class="text-gray-300">Languages:</strong>
                        <span class="text-gray-400 ml-2">${movie.spoken_languages.map(lang => lang.english_name).join(', ')}</span>
                    </div>
                    <p class="text-gray-300 mb-6">${movie.overview || 'No overview available.'}</p>
                    <div class="flex flex-wrap gap-3 mb-6">
                        <button data-movie-id="${movie.id}" onclick="toggleWatchlist(${JSON.stringify(movie).replace(/"/g, '&quot;')})" 
                                class="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg text-white flex items-center transition-colors">
                            <i data-lucide="bookmark" class="w-4 h-4 mr-2"></i>
                            ${isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                        </button>
                        ${trailerUrl ? `
                        <button onclick="showTrailerModal('${trailerUrl.replace('watch?v=', 'embed/')}')" 
                                class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-white flex items-center transition-colors">
                            <i data-lucide="play-circle" class="w-4 h-4 mr-2"></i>
                            Watch Trailer
                        </button>
                        ` : ''}
                        <button onclick="rateMovie(${movieId}, true); updateRatingButtons(${movieId})" 
                                id="like-btn-${movieId}" class="rating-btn px-4 py-2 rounded-lg flex items-center transition-colors ${isLiked ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}">
                            <i data-lucide="thumbs-up" class="w-4 h-4"></i>
                        </button>
                        <button onclick="rateMovie(${movieId}, false); updateRatingButtons(${movieId})" 
                                id="dislike-btn-${movieId}" class="rating-btn px-4 py-2 rounded-lg flex items-center transition-colors ${isDisliked ? 'bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}">
                            <i data-lucide="thumbs-down" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div id="recommendations-section" class="mt-10">
                <div class="section-navigation">
                    <h3 class="text-lg font-semibold mb-4 flex items-center">
                        <i data-lucide="target" class="w-5 h-5 mr-2 text-green-400"></i>
                        More Like This
                    </h3>
                    <div class="nav-controls">
                        <button class="nav-btn" onclick="scrollSection('recommendations-list', 'left')" title="Scroll Left (←)">
                            <i data-lucide="chevron-left"></i>
                        </button>
                        <button class="nav-btn" onclick="scrollSection('recommendations-list', 'right')" title="Scroll Right (→)">
                            <i data-lucide="chevron-right"></i>
                        </button>
                    </div>
                </div>
                <div id="recommendations-loading" class="flex justify-center py-8">
                    <svg class="animate-spin h-8 w-8 text-orange-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                </div>
                <div class="horizontal-scroll scrollbar-hide pb-2 gap-4" id="recommendations-list-container">
                    <div id="recommendations-list" class="flex gap-4"></div>
                    <div class="scroll-indicator">
                        <div class="scroll-progress" id="recommendations-list-progress"></div>
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        lucide.createIcons();

        // Fetch recommendations
        const recommendations = await getRecommendations(movieId);
        const recList = document.getElementById('recommendations-list');
        const recLoading = document.getElementById('recommendations-loading');
        recLoading.style.display = 'none';

        if (recommendations.length > 0) {
            recList.innerHTML = recommendations.slice(0, 12).map(rec => `
                <div class="flex-shrink-0 w-32 cursor-pointer hover:bg-gray-800/30 p-2 rounded-lg transition-colors" onclick="showMovieDetail(${rec.id})">
                    <img src="${getMoviePoster(rec)}" alt="${rec.title}" 
                            class="w-full h-44 object-cover rounded mb-2">
                    <div class="min-w-0">
                        <p class="text-xs font-medium text-white truncate">${rec.title}</p>
                        <p class="text-xs text-gray-400">${rec.release_date ? new Date(rec.release_date).getFullYear() : 'TBA'}</p>
                    </div>
                </div>
            `).join('');
            
            // Set up horizontal scrolling for the recommendations
            const scrollContainer = recList.closest('.horizontal-scroll');
            if (scrollContainer) {
                setupHorizontalScroll();
                updateNavigationButtons(scrollContainer);
            }
        } else {
            recList.innerHTML = `<p class="text-gray-400 text-center w-full">No recommendations found.</p>`;
        }
        lucide.createIcons();
    } catch (error) {
        console.error('Error fetching movie details:', error);
    }
}

function closeMovieModal() {
    document.getElementById('movie-modal').classList.add('hidden');
}

function closeTrailerModal() {
    document.getElementById('trailer-modal').classList.add('hidden');
    document.getElementById('trailer-iframe-container').innerHTML = '';
}

function showTrailerModal(embedUrl) {
    const modal = document.getElementById('trailer-modal');
    const container = document.getElementById('trailer-iframe-container');
    container.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allowfullscreen class="w-full h-full rounded-lg"></iframe>`;
    modal.classList.remove('hidden');
    lucide.createIcons();
}

// ===========================================
// WATCHLIST FUNCTIONS
// ===========================================
function toggleWatchlist(movie) {
    const index = watchlist.findIndex(item => item.id === movie.id);
    let message = '';
    if (index === -1) {
        watchlist.push(movie);
        message = 'Added to Watchlist!';
    } else {
        watchlist.splice(index, 1);
        message = 'Removed from Watchlist!';
    }
    // Keep userProfile.watchlist in sync with local watchlist
    userProfile.watchlist = [...watchlist];
    saveUserProfile();
    updateWatchlistCount();
    updateWatchlistModal();
    updateWatchlistButton(movie);
    showToast(message, 'success');
    
    // Refresh recommendations after watchlist change
    loadPersonalizedRecommendations();
}

function updateWatchlistCount() {
    const countEl = document.getElementById('watchlist-count');
    if (watchlist.length > 0) {
        countEl.textContent = watchlist.length;
        countEl.classList.remove('hidden');
    } else {
        countEl.classList.add('hidden');
    }
}

function updateWatchlistButton(course) {
    const isInWatchlist = watchlist.some(item => item.id === course.id);
    
    // Update course card buttons
    const courseButtons = document.querySelectorAll(`[data-course-id="${course.id}"]`);
    courseButtons.forEach(button => {
        if (button.classList.contains('watchlist-btn')) {
            button.innerHTML = `
                <i data-lucide="${isInWatchlist ? 'check' : 'plus'}" class="w-4 h-4 mr-2"></i>
                ${isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
            `;
            button.className = `watchlist-btn w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                isInWatchlist 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`;
        } else {
            // Update modal buttons that don't have watchlist-btn class
            button.innerHTML = `
                <i data-lucide="bookmark" class="w-4 h-4 mr-2"></i>
                ${isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            `;
            button.className = `${
                isInWatchlist 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-orange-600 hover:bg-orange-700'
            } px-4 py-2 rounded-lg text-white flex items-center transition-colors`;
        }
    });
    
    // Also update any movie buttons for backward compatibility
    const movieButtons = document.querySelectorAll(`[data-movie-id="${course.id}"]`);
    movieButtons.forEach(button => {
        if (button.classList.contains('watchlist-btn')) {
            button.innerHTML = `
                <i data-lucide="${isInWatchlist ? 'check' : 'plus'}" class="w-4 h-4 mr-2"></i>
                ${isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
            `;
            button.className = `watchlist-btn w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                isInWatchlist 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`;
        } else {
            // Update modal buttons that don't have watchlist-btn class
            button.innerHTML = `
                <i data-lucide="bookmark" class="w-4 h-4 mr-2"></i>
                ${isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            `;
            button.className = `${
                isInWatchlist 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-orange-600 hover:bg-orange-700'
            } px-4 py-2 rounded-lg text-white flex items-center transition-colors`;
        }
    });
    
    lucide.createIcons();
}

function updateWatchlistModal() {
    const content = document.getElementById('watchlist-content');
    if (watchlist.length === 0) {
        content.innerHTML = `
            <div class="text-center py-12 col-span-full">
                <i data-lucide="bookmark" class="w-16 h-16 mx-auto text-gray-600 mb-4"></i>
                <p class="text-gray-400">Your watchlist is empty</p>
            </div>
        `;
    } else {
        content.innerHTML = watchlist.map(movie => `
            <div class="bg-gray-800/30 rounded-2xl p-4">
                <img src="${getPosterUrl(movie.poster_path)}" alt="${movie.title}" 
                        class="w-full object-cover rounded-xl mb-3 cursor-pointer" onclick="showMovieDetail(${movie.id})">
                <h3 class="font-semibold text-sm mb-2 line-clamp-1">${movie.title}</h3>
                <button onclick="toggleWatchlist(${JSON.stringify(movie).replace(/"/g, '&quot;')})" 
                        class="w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg text-sm flex items-center justify-center transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4 mr-2"></i>
                    Remove
                </button>
            </div>
        `).join('');
    }
    lucide.createIcons();
}

// ===========================================
// DISPLAY & SEARCH FUNCTIONS
// ===========================================
async function displayCourses(courses, containerId, showTrendingNumbers = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Filter courses (no adult content for courses, but we can filter by other criteria)
    const filtered = Array.isArray(courses) ? courses : [];

    // Build skeletons first to avoid flicker
    const skeletonCount = 10;
    const skeletons = Array.from({ length: skeletonCount }).map(() => `
        <div class="movie-card skeleton-card">
            <div class="bg-gray-800/30 rounded-2xl p-4">
                <div class="skeleton-animate rounded-xl aspect-[16/9] mb-4"></div>
                <div class="skeleton-animate h-4 rounded mb-2"></div>
                <div class="skeleton-animate h-3 rounded mb-2 w-2/3"></div>
                <div class="skeleton-animate h-8 rounded mt-4"></div>
            </div>
        </div>
    `).join('');
    container.innerHTML = skeletons;

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center min-w-full">No courses found.</p>';
        return;
    }

    // Defer DOM replacement to next frame to reduce layout thrash
    const visibleCourses = filtered.slice(0, 10);
    const courseCards = visibleCourses.map((course, index) => createCourseCard(course, showTrendingNumbers, index)).join('');

    requestAnimationFrame(() => {
        container.innerHTML = courseCards;
        lucide.createIcons();

        const scrollContainer = container.closest('.horizontal-scroll');
        if (scrollContainer) {
            setupHorizontalScroll();
            updateNavigationButtons(scrollContainer);
        }
    });
}

// ===========================================
// SEARCH SUGGESTIONS FUNCTIONS
// ===========================================
let searchTimeout;
let currentSuggestions = [];
let selectedSuggestionIndex = -1;
let suggestionsController = null;
let searchController = null;
let recsController = null;
let recsDebounceTimeout = null;

// Simple local suggestions for very short queries
function getImmediateSuggestions(query) {
    const commonMovies = [
        { title: "The Dark Knight", id: 155 },
        { title: "Inception", id: 27205 },
        { title: "Interstellar", id: 157336 },
        { title: "The Matrix", id: 603 },
        { title: "Pulp Fiction", id: 680 },
        { title: "The Godfather", id: 238 },
        { title: "Avatar", id: 19995 },
        { title: "Titanic", id: 597 },
        { title: "Star Wars", id: 11 },
        { title: "The Avengers", id: 24428 }
    ];
    
    const queryLower = query.toLowerCase();
    return commonMovies
        .filter(movie => movie.title.toLowerCase().includes(queryLower))
        .slice(0, 4); // Limit to 4 for immediate suggestions
}

async function getSearchSuggestions(query) {
    if (!query.trim() || query.length < 2) {
        hideSuggestions();
        return;
    }
    
    // For very short queries, show suggestions immediately
    if (query.length <= 3) {
        // Show immediate suggestions for short queries
        const immediateSuggestions = await getImmediateSuggestions(query);
        if (immediateSuggestions.length > 0) {
            currentSuggestions = immediateSuggestions;
            displaySuggestions(immediateSuggestions);
            return;
        }
    }

    try {
        // Cache lookup
        const cacheKey = `${query}|${(userProfile.language||[]).join(',')}|${userProfile.safe_mode?'1':'0'}`;
        const cached = suggestionCache.get(cacheKey);
        if (cached && (Date.now() - cached.time) < CACHE_TTL_MS) {
            currentSuggestions = cached.results;
            displaySuggestions(cached.results);
            return;
        }
        // Abort any in-flight suggestions request
        if (suggestionsController) {
            suggestionsController.abort();
        }
        suggestionsController = new AbortController();

        const params = new URLSearchParams();
        params.set('query', query);
        params.set('limit', '6'); // Limit suggestions to 6 for faster response
        
        if (userProfile.safe_mode) {
            params.set('safe_mode', 'true');
        }
        
        if (userProfile.language && userProfile.language.length > 0) {
            params.set('languages', userProfile.language.join(','));
        }
        
                    const response = await fetch(`${config.BACKEND_BASE_URL}/search?${params.toString()}`, { signal: suggestionsController.signal });
        const results = await response.json();
        
        if (Array.isArray(results)) {
            currentSuggestions = results;
            displaySuggestions(results);
            suggestionCache.set(cacheKey, { results, time: Date.now() });
        } else {
            currentSuggestions = [];
            displaySuggestions([]);
        }
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        currentSuggestions = [];
        displaySuggestions([]);
    }
}

function displaySuggestions(suggestions) {
    const suggestionsContainer = document.getElementById('search-suggestions');
    const content = document.getElementById('suggestions-content');
    
    if (!suggestions || suggestions.length === 0) {
        content.innerHTML = `
            <div class="no-suggestions">
                <i data-lucide="search" class="w-5 h-5 mx-auto mb-2 text-gray-500"></i>
                <p>No movies found</p>
            </div>
        `;
        suggestionsContainer.classList.remove('hidden');
        return;
    }

        content.innerHTML = suggestions.map((movie, index) => `
        <div class="search-suggestion-item" data-index="${index}" onclick="selectSuggestion(${index})">
            <img src="${getPosterUrl(movie.poster_path)}" alt="${movie.title}" class="suggestion-poster" loading="lazy">
            <div class="suggestion-info">
                <div class="suggestion-title">${movie.title}</div>
                <div class="suggestion-meta">
                    ${movie.release_date ? `<span class="suggestion-year">${new Date(movie.release_date).getFullYear()}</span>` : ''}
                    ${movie.vote_average && movie.vote_average > 0 ? `
                        <span class="suggestion-rating">
                            <i data-lucide="star" class="w-3 h-3"></i>
                            ${movie.vote_average.toFixed(1)}
                        </span>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');

    suggestionsContainer.classList.remove('hidden');
    lucide.createIcons();
    selectedSuggestionIndex = -1;
}

function selectSuggestion(index) {
    if (index >= 0 && index < currentSuggestions.length) {
        const movie = currentSuggestions[index];
        document.getElementById('search-input').value = movie.title;
        hideSuggestions();
        
        // Trigger search with the selected movie title
        searchMovies(movie.title);
    }
}

function hideSuggestions() {
    const suggestionsContainer = document.getElementById('search-suggestions');
    suggestionsContainer.classList.add('hidden');
    selectedSuggestionIndex = -1;
}

function handleSuggestionNavigation(direction) {
    if (currentSuggestions.length === 0) return;
    
    const items = document.querySelectorAll('.search-suggestion-item');
    if (items.length === 0) return;

    // Remove previous selection
    if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
        items[selectedSuggestionIndex].classList.remove('selected');
    }

    if (direction === 'down') {
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, currentSuggestions.length - 1);
    } else if (direction === 'up') {
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
    }

    // Add new selection
    if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
        items[selectedSuggestionIndex].classList.add('selected');
        items[selectedSuggestionIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function handleSuggestionEnter() {
    if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < currentSuggestions.length) {
        selectSuggestion(selectedSuggestionIndex);
    } else {
        // If no suggestion is selected, perform regular search
        const query = document.getElementById('search-input').value.trim();
        if (query) {
            searchMovies(query);
        }
    }
}

async function searchCourses(query) {
    if (!query.trim()) return;

    try {
        document.getElementById('loading-spinner').classList.remove('hidden');
        hideSuggestions(); // Hide suggestions when performing search

        // Abort any in-flight search and recommendation requests
        if (searchController) {
            searchController.abort();
        }
        if (recsController) {
            recsController.abort();
        }
        searchController = new AbortController();
        
        // Build search URL
        const params = new URLSearchParams();
        params.set('query', query);
        params.set('limit', '12');
        
        // Cache lookup
        const cacheKey = `search-${query}`;
        const cached = searchResultCache.get(cacheKey);
        let results;
        
        if (cached && (Date.now() - cached.time) < CACHE_TTL_MS) {
            results = cached.results;
        } else {
            const response = await fetch(`${config.BACKEND_BASE_URL}/search?${params.toString()}`, {
                signal: searchController.signal,
                cache: 'no-store'
            });
            
            if (response.ok) {
                results = await response.json();
                searchResultCache.set(cacheKey, { results, time: Date.now() });
            } else {
                throw new Error(`Search failed with status ${response.status}`);
            }
        }

        const searchSection = document.getElementById('search-results');
        const recommendationsSection = document.getElementById('recommendations');

        if (results.length > 0) {
            addToHistory(results[0].id);
            
            searchSection.classList.remove('hidden');
            await displayCourses(results, 'search-movies');

            // Fetch recommendations for first result
            try {
                if (recsController) {
                    recsController.abort();
                }
                recsController = new AbortController();
                
                const recParams = new URLSearchParams();
                recParams.set('course_id', results[0].id);
                recParams.set('limit', '10');
                
                const recResponse = await fetch(`${config.BACKEND_BASE_URL}/recommendations?${recParams.toString()}`, {
                    signal: recsController.signal,
                    cache: 'no-store'
                });
                
                if (recResponse.ok) {
                    const recommendations = await recResponse.json();
                    if (recommendations.length > 0) {
                        recommendationsSection.classList.remove('hidden');
                        await displayCourses(recommendations, 'recommendation-movies');
                    } else {
                        recommendationsSection.classList.add('hidden');
                    }
                } else {
                    recommendationsSection.classList.add('hidden');
                }
            } catch (recError) {
                console.warn('Failed to load recommendations:', recError);
                recommendationsSection.classList.add('hidden');
            }
        } else {
            searchSection.classList.add('hidden');
            recommendationsSection.classList.add('hidden');
            document.getElementById('search-input').focus();
            showToast('No courses found for that search.', 'warning');
        }
    } catch (error) {
        console.error('Error searching courses:', error);
        showToast('Search failed. Please try again.', 'error');
    } finally {
        document.getElementById('loading-spinner').classList.add('hidden');
    }
}

// Alias for backward compatibility
const searchMovies = searchCourses;

async function loadInitialData() {
    try {
        const trendingPromise = fetch(`${config.BACKEND_BASE_URL}/trending?limit=12`);
        const topRatedPromise = fetch(`${config.BACKEND_BASE_URL}/top-rated?limit=12`);

        const [trendingResponse, topRatedResponse] = await Promise.all([trendingPromise, topRatedPromise]);
        
        const trending = await trendingResponse.json();
        const topRated = await topRatedResponse.json();

        displayCourses(trending, 'trending-movies', true);
        displayCourses(topRated, 'toprated-movies');

        // Load personalized recommendations (non-blocking)
        loadPersonalizedRecommendations();
    } catch (error) {
        console.error('Error loading initial data:', error);
        showToast('Failed to load courses. Please refresh the page.', 'error');
    }
}

async function fetchPersonalizedRecommendations() {
    try {
        const payload = {
            interests: userProfile.liked_courses || [],
            skill_level: userProfile.skill_level || 'beginner',
            language: userProfile.language || ['en'],
            budget: userProfile.budget || 'any',
            mood: userProfile.mood || 'happy'
        };

        const response = await fetch(`${config.BACKEND_BASE_URL}/recommendations/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            return await response.json();
        } else {
            console.warn('Personalized recommendations failed:', response.status);
            return [];
        }
    } catch (error) {
        console.error('Error fetching personalized recommendations:', error);
        return [];
    }
}

async function loadPersonalizedRecommendations() {
    // Debounce and abort to prevent blocking searches
    if (recsDebounceTimeout) clearTimeout(recsDebounceTimeout);
    return new Promise((resolve) => {
        recsDebounceTimeout = setTimeout(async () => {
            if (recsController) recsController.abort();
            recsController = new AbortController();

            const container = document.getElementById('user-recommendation-movies');
            container.innerHTML = `
                <div class="text-center py-12 text-gray-400">
                    <svg class="animate-spin h-8 w-8 mx-auto mb-4 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    <p>Loading recommendations...</p>
                </div>
            `;

            try {
                const recommendedCourses = await fetchPersonalizedRecommendations();
                if (recommendedCourses && recommendedCourses.length > 0) {
                    container.innerHTML = '';
                    await displayCourses(recommendedCourses, 'user-recommendation-movies');
                } else {
                    container.innerHTML = `
                        <div class="text-center py-12 text-gray-400">
                            <i data-lucide="heart" class="w-16 h-16 mx-auto mb-4"></i>
                            <p>Take more courses to get personalized recommendations</p>
                        </div>
                    `;
                    lucide.createIcons();
                }
            } catch (error) {
                if (error?.name === 'AbortError') return resolve();
                console.error('Error loading personalized recommendations:', error);
                container.innerHTML = `
                    <div class="text-center py-12 text-red-500">
                        <i data-lucide="alert-triangle" class="w-16 h-16 mx-auto mb-4"></i>
                        <p>Failed to load personalized recommendations. Try again later.</p>
                    </div>
                `;
                lucide.createIcons();
            } finally {
                resolve();
            }
        }, 400);
    });
}




// ===========================================
// PROFILE & RATING FUNCTIONS
// ===========================================
async function saveProfile() {
    const name = document.getElementById('profile-name-input').value.trim();
    const age = parseInt(document.getElementById('profile-age-input').value);
    const region = document.getElementById('profile-region-input').value;
    const safeMode = document.getElementById('safe-mode-input').checked;
    const languages = Array.from(document.getElementById('profile-languages-input').selectedOptions).map(option => option.value);

    if (!age || isNaN(age) || age < 13 || age > 100) {
        showToast('Please enter a valid age between 13 and 100.', 'warning');
        return;
    }

    if (age < 18 && !safeMode) {
        document.getElementById('safe-mode-input').checked = true;
        showToast('Safe Mode is required for users under 18 years old.', 'warning');
        return;
    }

    if (age >= 18 && !safeMode) {
        showToast('Safe Mode disabled. Adult content may be shown.', 'warning');
    }

    userProfile.name = name || 'User';
    userProfile.age = age || 25;
    userProfile.region = region;
    userProfile.safe_mode = safeMode;
    userProfile.language = languages.length > 0 ? languages : ['en'];

    saveUserProfile();
    updateUI();
    document.getElementById('profile-modal').classList.add('hidden');
    showToast('Profile saved successfully!', 'success');
    
    // Reload personalized recommendations with updated profile
    await loadPersonalizedRecommendations();
}

function handleProfilePicUpload(event) {
    const file = event.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file.', 'warning');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            userProfile.profile_pic = dataUrl;
            document.getElementById('profile-pic').src = dataUrl;
            document.getElementById('profile-pic-large').src = dataUrl;
            saveUserProfile();
        };
        reader.readAsDataURL(file);
    }
}

function addToHistory(movieId) {
    if (!userProfile.history.includes(movieId)) {
        userProfile.history.unshift(movieId);
        if (userProfile.history.length > 100) {
            userProfile.history = userProfile.history.slice(0, 100);
        }
        saveUserProfile();
    }
}

function rateCourse(courseId, liked) {
    if (!userProfile.liked_courses) userProfile.liked_courses = [];
    if (!userProfile.disliked_courses) userProfile.disliked_courses = [];
    
    if (liked) {
        if (!userProfile.liked_courses.includes(courseId)) {
            userProfile.liked_courses.push(courseId);
        }
        userProfile.disliked_courses = userProfile.disliked_courses.filter(id => id !== courseId);
    } else {
        if (!userProfile.disliked_courses.includes(courseId)) {
            userProfile.disliked_courses.push(courseId);
        }
        userProfile.liked_courses = userProfile.liked_courses.filter(id => id !== courseId);
    }
    saveUserProfile();
    
    // Refresh recommendations after rating change
    loadPersonalizedRecommendations();
}

function rateMovie(movieId, liked) {
    if (liked) {
        if (!userProfile.liked_movies.includes(movieId)) {
            userProfile.liked_movies.push(movieId);
        }
        userProfile.disliked_movies = userProfile.disliked_movies.filter(id => id !== movieId);
    } else {
        if (!userProfile.disliked_movies.includes(movieId)) {
            userProfile.disliked_movies.push(movieId);
        }
        userProfile.liked_movies = userProfile.liked_movies.filter(id => id !== movieId);
    }
    saveUserProfile();
    
    // Refresh recommendations after rating change
    loadPersonalizedRecommendations();
}

function updateRatingButtons(movieId) {
    const isLiked = userProfile.liked_movies.includes(movieId);
    const isDisliked = userProfile.disliked_movies.includes(movieId);
    
    const likeBtn = document.getElementById(`like-btn-${movieId}`);
    const dislikeBtn = document.getElementById(`dislike-btn-${movieId}`);
    
    if (likeBtn) {
        likeBtn.className = `rating-btn px-4 py-2 rounded-lg flex items-center transition-colors ${isLiked ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`;
    }
    
    if (dislikeBtn) {
        dislikeBtn.className = `rating-btn px-4 py-2 rounded-lg flex items-center transition-colors ${isDisliked ? 'bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`;
    }
}

// ===========================================
// EVENT LISTENERS
// ===========================================
function setupEventListeners() {
    // Home link functionality
    document.querySelectorAll('a[title="Go to Homepage"]').forEach(homeLink => {
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Clear search results
            document.getElementById('search-results').classList.add('hidden');
            document.getElementById('recommendations').classList.add('hidden');
            document.getElementById('search-input').value = '';
            
            // Smooth scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Show toast
            showToast('Welcome back to CourseScout! 🎓', 'success');
            
            // Optional: Refresh trending movies
            loadInitialData();
        });
    });

    // Search
    document.getElementById('search-btn').addEventListener('click', () => {
        const query = document.getElementById('search-input').value.trim();
        if (query) {
            searchMovies(query);
        } else {
            document.getElementById('search-results').classList.add('hidden');
            document.getElementById('recommendations').classList.add('hidden');
            document.getElementById('search-input').focus();
        }
    });

    // Search input event listeners for suggestions
    document.getElementById('search-input').addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // If input is empty, hide suggestions immediately
        if (!query) {
            hideSuggestions();
            return;
        }
        
        // Set new timeout for debounced search suggestions
        searchTimeout = setTimeout(() => {
            getSearchSuggestions(query);
        }, 150); // 150ms delay for faster response
    });

    document.getElementById('search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSuggestionEnter();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleSuggestionNavigation('down');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleSuggestionNavigation('up');
        } else if (e.key === 'Escape') {
            hideSuggestions();
            document.getElementById('search-input').blur();
        }
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        const searchContainer = document.getElementById('search-input').closest('.relative');
        if (!searchContainer.contains(e.target)) {
            hideSuggestions();
        }
    });

    // Focus/blur events for search input
    document.getElementById('search-input').addEventListener('focus', () => {
        const query = document.getElementById('search-input').value.trim();
        if (query.length >= 2) {
            // Show immediate suggestions for focused input
            if (query.length <= 3) {
                const immediateSuggestions = getImmediateSuggestions(query);
                if (immediateSuggestions.length > 0) {
                    currentSuggestions = immediateSuggestions;
                    displaySuggestions(immediateSuggestions);
                    return;
                }
            }
            getSearchSuggestions(query);
        }
    });

    document.getElementById('search-input').addEventListener('blur', () => {
        // Small delay to allow clicking on suggestions
        setTimeout(() => {
            if (!document.querySelector('.search-suggestion-item:hover')) {
                hideSuggestions();
            }
        }, 150);
    });

    // Profile
    document.getElementById('profile-btn').addEventListener('click', () => {
        document.getElementById('profile-modal').classList.remove('hidden');
    });

    document.getElementById('close-profile-modal').addEventListener('click', () => {
        document.getElementById('profile-modal').classList.add('hidden');
    });

    document.getElementById('save-profile').addEventListener('click', saveProfile);
    document.getElementById('profile-pic-input').addEventListener('change', handleProfilePicUpload);
    document.getElementById('profile-languages-input').addEventListener('change', updateLanguageBadges);

    // Mood buttons
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mood-btn').forEach(b => {
                b.classList.remove('selected');
            });
            btn.classList.add('selected');
            userProfile.mood = btn.dataset.mood;
            saveUserProfile();
            // Refresh recommendations based on new mood
            loadPersonalizedRecommendations();
        });
    });

                    // Mood popup
        document.querySelectorAll('.mood-popup-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                userProfile.mood = btn.dataset.mood;
                userProfile.last_mood_update = new Date();
                saveUserProfile();
                
                // Update the mood selection in the profile section
                updateMoodSelection();
                
                // Refresh recommendations based on new mood
                loadPersonalizedRecommendations();
                
                document.getElementById('mood-popup').classList.add('hidden');
            });
        });

    document.getElementById('skip-mood').addEventListener('click', () => {
        userProfile.last_mood_update = new Date();
        saveUserProfile();
        document.getElementById('mood-popup').classList.add('hidden');
    });

    // Watchlist
    document.getElementById('watchlist-btn').addEventListener('click', () => {
        document.getElementById('watchlist-modal').classList.remove('hidden');
        updateWatchlistModal();
    });

    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('watchlist-modal').classList.add('hidden');
    });

    // Modal outside click handlers
    document.getElementById('profile-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('profile-modal').classList.add('hidden');
        }
    });

    document.getElementById('watchlist-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('watchlist-modal').classList.add('hidden');
        }
    });

    document.getElementById('course-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeCourseModal();
        }
    });

    document.getElementById('movie-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeMovieModal();
        }
    });

    document.getElementById('mood-popup').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            userProfile.last_mood_update = new Date();
            saveUserProfile();
            document.getElementById('mood-popup').classList.add('hidden');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Avoid global shortcuts when user is typing in the search input
        const activeEl = document.activeElement;
        const typingInSearch = activeEl && activeEl.id === 'search-input';
        if (typingInSearch) return;
        if (e.key === 'Escape') {
            document.getElementById('profile-modal').classList.add('hidden');
            document.getElementById('watchlist-modal').classList.add('hidden');
            document.getElementById('course-modal').classList.add('hidden');
            document.getElementById('movie-modal').classList.add('hidden');
            document.getElementById('mood-popup').classList.add('hidden');
            closeTrailerModal();
        }
        
        // Horizontal scrolling with arrow keys
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const activeElement = document.activeElement;
            const scrollContainer = activeElement.closest('.horizontal-scroll');
            if (scrollContainer) {
                e.preventDefault();
                const scrollAmount = 300;
                if (e.key === 'ArrowLeft') {
                    scrollContainer.scrollLeft -= scrollAmount;
                } else {
                    scrollContainer.scrollLeft += scrollAmount;
                }
            }
        }
        
        // Additional keyboard shortcuts
        if (e.key === 'Home') {
            const activeElement = document.activeElement;
            const scrollContainer = activeElement.closest('.horizontal-scroll');
            if (scrollContainer) {
                e.preventDefault();
                scrollContainer.scrollLeft = 0;
            }
        }
        
        if (e.key === 'End') {
            const activeElement = document.activeElement;
            const scrollContainer = activeElement.closest('.horizontal-scroll');
            if (scrollContainer) {
                e.preventDefault();
                scrollContainer.scrollLeft = scrollContainer.scrollWidth;
            }
        }
    });
}

// ===========================================
// NAVIGATION AND SCROLLING FUNCTIONS
// ===========================================

function scrollSection(sectionId, direction) {
    const container = document.getElementById(sectionId + '-container') || document.getElementById(sectionId);
    if (!container) return;
    
    const scrollAmount = 300;
    const currentScroll = container.scrollLeft;
    
    if (direction === 'left') {
        container.scrollLeft = Math.max(0, currentScroll - scrollAmount);
    } else {
        container.scrollLeft = currentScroll + scrollAmount;
    }
    
    // Update button states
    updateNavigationButtons(container);
}

function updateNavigationButtons(container) {
    const sectionId = container.id.replace('-container', '');
    const leftBtn = container.parentElement.querySelector('.nav-btn[onclick*="left"]');
    const rightBtn = container.parentElement.querySelector('.nav-btn[onclick*="right"]');
    
    if (leftBtn) {
        leftBtn.disabled = container.scrollLeft <= 0;
    }
    if (rightBtn) {
        rightBtn.disabled = container.scrollLeft >= container.scrollWidth - container.clientWidth;
    }
    
    // Update scroll progress indicator
    updateScrollProgress(container);
}

function updateScrollProgress(container) {
    const progressBar = container.querySelector('.scroll-progress');
    if (progressBar) {
        const scrollableWidth = container.scrollWidth - container.clientWidth;
        if (scrollableWidth > 0) {
            const progress = (container.scrollLeft / scrollableWidth) * 100;
            progressBar.style.width = `${progress}%`;
        } else {
            progressBar.style.width = '0%';
        }
    }
}

function setupHorizontalScroll() {
    const scrollContainers = document.querySelectorAll('.horizontal-scroll');
    
    scrollContainers.forEach(container => {

        
        // Touch/swipe support with momentum
        let startX = 0;
        let startY = 0;
        let isScrolling = false;
        let lastScrollTime = 0;
        
        container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isScrolling = false;
            lastScrollTime = Date.now();
        });
        
        container.addEventListener('touchmove', (e) => {
            if (!isScrolling) {
                const deltaX = Math.abs(e.touches[0].clientX - startX);
                const deltaY = Math.abs(e.touches[0].clientY - startY);
                
                if (deltaX > deltaY && deltaX > 10) {
                    isScrolling = true;
                }
            }
            
            if (isScrolling) {
                e.preventDefault();
                container.scrollLeft -= e.touches[0].clientX - startX;
                startX = e.touches[0].clientX;
                lastScrollTime = Date.now();
            }
        });
        
        container.addEventListener('touchend', (e) => {
            if (isScrolling) {
                const timeDiff = Date.now() - lastScrollTime;
                if (timeDiff < 100) {
                    // Add momentum scrolling
                    container.classList.add('scrolling');
                    setTimeout(() => {
                        container.classList.remove('scrolling');
                    }, 300);
                }
            }
        });
        
        // Update navigation buttons on scroll
        container.addEventListener('scroll', () => {
            updateNavigationButtons(container);
        });
        
        // Initial button state update
        updateNavigationButtons(container);
    });
}

// ===========================================
// INITIALIZE ON LOAD
// ===========================================
// This is now handled in the main initialization function above

function setupAccessibility() {
    // Add ARIA labels and roles for better screen reader support
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        
        // Add keyboard support for Enter and Space keys
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
    });
    
    // Add focus indicators for keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
        }
    });
    
    document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-navigation');
    });
}
