/**
 * CourseMate - AI-Powered Course Recommendation System
 * Configuration Management
 * 
 * Author: Ajay Mathuriya
 * Institution: Minor in AI from IIT Ropar (iitrprai_24081389)
 * 
 * Handles environment variables and application configuration
 */

// Configuration loader for environment variables
class Config {
    constructor() {
        this.loadConfig();
    }

    loadConfig() {
        // Load from config.env file or use defaults
        this.UDEMY_API_KEY = this.getEnvVar('UDEMY_API_KEY', 'your_udemy_api_key_here');
        this.UDEMY_BASE_URL = this.getEnvVar('UDEMY_BASE_URL', 'https://www.udemy.com/api-2.0');
        this.COURSERA_BASE_URL = this.getEnvVar('COURSERA_BASE_URL', 'https://api.coursera.org/api');
        this.EDX_BASE_URL = this.getEnvVar('EDX_BASE_URL', 'https://courses.edx.org/api');
        this.IMAGE_BASE_URL = this.getEnvVar('IMAGE_BASE_URL', 'https://img-c.udemycdn.com');
        this.FALLBACK_POSTER_URL = this.getEnvVar('FALLBACK_POSTER_URL', 'https://dummyimage.com/480x270/1f2937/9ca3af&text=No+Image');
        this.COURSE_LINK_BASE = this.getEnvVar('COURSE_LINK_BASE', 'https://www.udemy.com');
        
        // Default to deployed Render backend; can be overridden via env var
        this.BACKEND_BASE_URL = this.getEnvVar('BACKEND_BASE_URL', 'https://course-review-recommendation-engine.onrender.com');
        this.API_TIMEOUT_SEC = parseInt(this.getEnvVar('API_TIMEOUT_SEC', '20'));
        this.API_MAX_RETRIES = parseInt(this.getEnvVar('API_MAX_RETRIES', '3'));
        
        this.MODEL_CACHE_DIR = this.getEnvVar('MODEL_CACHE_DIR', './models');
        
        this.CACHE_TTL_MS = parseInt(this.getEnvVar('CACHE_TTL_MS', '60000'));
        this.API_BATCH_SIZE = parseInt(this.getEnvVar('API_BATCH_SIZE', '6'));
        this.API_MAX_PER_HOST = parseInt(this.getEnvVar('API_MAX_PER_HOST', '12'));
        
        this.DEBUG = this.getEnvVar('DEBUG', 'true') === 'true';
        this.LOG_LEVEL = this.getEnvVar('LOG_LEVEL', 'INFO');
    }

    getEnvVar(key, defaultValue) {
        // Try to get from environment variables (if running in Node.js)
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
        
        // Try to get from config.env file (for browser environment)
        try {
            // For browser environment, we'll need to load this differently
            // For now, return default values
            return defaultValue;
        } catch (error) {
            console.warn(`Could not load ${key} from environment, using default: ${defaultValue}`);
            return defaultValue;
        }
    }

    // Method to update configuration at runtime
    updateConfig(newConfig) {
        Object.assign(this, newConfig);
    }

    // Get all configuration as an object
    getAll() {
        return {
            UDEMY_API_KEY: this.UDEMY_API_KEY,
            UDEMY_BASE_URL: this.UDEMY_BASE_URL,
            COURSERA_BASE_URL: this.COURSERA_BASE_URL,
            EDX_BASE_URL: this.EDX_BASE_URL,
            IMAGE_BASE_URL: this.IMAGE_BASE_URL,
            FALLBACK_POSTER_URL: this.FALLBACK_POSTER_URL,
            COURSE_LINK_BASE: this.COURSE_LINK_BASE,
            BACKEND_BASE_URL: this.BACKEND_BASE_URL,
            API_TIMEOUT_SEC: this.API_TIMEOUT_SEC,
            API_MAX_RETRIES: this.API_MAX_RETRIES,
            MODEL_CACHE_DIR: this.MODEL_CACHE_DIR,
            CACHE_TTL_MS: this.CACHE_TTL_MS,
            API_BATCH_SIZE: this.API_BATCH_SIZE,
            API_MAX_PER_HOST: this.API_MAX_PER_HOST,
            DEBUG: this.DEBUG,
            LOG_LEVEL: this.LOG_LEVEL
        };
    }
}

// Create global config instance
const config = new Config();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}

