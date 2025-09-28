# Course Data Sources for CourseScout

## Recommended APIs and Data Sources

### 1. Udemy Affiliate API (Primary Choice)
**Status**: FREE with registration
**URL**: https://www.udemy.com/developers/affiliate/
**Data Available**:
- Course details (title, description, rating, price)
- Instructor information
- Categories and subcategories
- Reviews and ratings
- Course thumbnails
- Enrollment data
- Duration and level

**Advantages**:
- Well-documented API
- Rich course metadata
- High-quality data
- Large course catalog

### 2. Coursera Course Catalog API
**Status**: Public course information available
**URL**: https://api.coursera.org/api/courses.v1/courses
**Data Available**:
- Course information
- University partnerships
- Specializations
- Course ratings

### 3. edX Course Discovery API
**Status**: Publicly available
**URL**: https://courses.edx.org/api/courses/v1/courses/
**Data Available**:
- Course catalog
- Course details
- University information
- Course start dates

### 4. Alternative: Web Scraping (Backup)
If APIs are not sufficient, we can scrape:
- Course aggregator sites
- Individual platform course pages
- Use libraries like BeautifulSoup and Scrapy

## Recommended Implementation Strategy

1. **Start with Udemy API** - Most comprehensive and reliable
2. **Add Coursera and edX** for diversity
3. **Implement caching** to reduce API calls
4. **Create course data pipeline** to normalize data from different sources

## Sample Course Data Structure

```json
{
  "id": 12345,
  "title": "Complete Python Bootcamp",
  "description": "Learn Python programming from scratch...",
  "instructor": "John Smith",
  "platform": "udemy",
  "rating": 4.6,
  "enrollment_count": 50000,
  "duration": "40 hours",
  "level": "beginner",
  "price": "$49.99",
  "categories": ["Programming", "Python"],
  "image_url": "https://img-c.udemycdn.com/course/480x270/...",
  "course_url": "https://www.udemy.com/course/...",
  "last_updated": "2024-01-15"
}
```

## Next Steps

1. Register for Udemy Affiliate API key
2. Test API endpoints and data quality
3. Implement data fetching and caching
4. Create course recommendation algorithms