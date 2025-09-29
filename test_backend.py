import main
import uvicorn
import threading
import time
import requests
import json

def start_server():
    uvicorn.run(main.app, host="127.0.0.1", port=8000, log_level="error")

def test_endpoints():
    try:
        # Test API status
        print("=== Testing API Status ===")
        response = requests.get("http://127.0.0.1:8000/api")
        if response.status_code == 200:
            print("✅ API is running")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"❌ API returned {response.status_code}")
        
        # Test search functionality
        print("\n=== Testing Search ===")
        search_response = requests.get("http://127.0.0.1:8000/search?query=python")
        if search_response.status_code == 200:
            courses = search_response.json()
            print(f"✅ Search returned {len(courses)} courses")
            if courses:
                course = courses[0]
                print(f"First course: {course['title']}")
                print(f"Rating: {course.get('rating', 'N/A')}")
                print(f"Instructor: {course.get('visible_instructors', [{}])[0].get('name', 'N/A')}")
                print(f"Image URL: {course.get('image_480x270', 'N/A')}")
        else:
            print(f"❌ Search returned {search_response.status_code}")
        
        # Test trending courses
        print("\n=== Testing Trending ===")
        trending_response = requests.get("http://127.0.0.1:8000/trending")
        if trending_response.status_code == 200:
            trending = trending_response.json()
            print(f"✅ Trending returned {len(trending)} courses")
            if trending:
                course = trending[0]
                print(f"Top trending: {course['title']}")
                print(f"Subscribers: {course.get('num_subscribers', 'N/A')}")
        else:
            print(f"❌ Trending returned {trending_response.status_code}")
            
        # Test top-rated courses
        print("\n=== Testing Top Rated ===")
        toprated_response = requests.get("http://127.0.0.1:8000/top-rated")
        if toprated_response.status_code == 200:
            toprated = toprated_response.json()
            print(f"✅ Top-rated returned {len(toprated)} courses")
            if toprated:
                course = toprated[0]
                print(f"Top rated: {course['title']}")
                print(f"Rating: {course.get('rating', 'N/A')}")
        else:
            print(f"❌ Top-rated returned {toprated_response.status_code}")
            
        # Test frontend
        print("\n=== Testing Frontend ===")
        frontend_response = requests.get("http://127.0.0.1:8000/")
        if frontend_response.status_code == 200:
            print("✅ Frontend is accessible")
            print(f"Content length: {len(frontend_response.text)} characters")
        else:
            print(f"❌ Frontend returned {frontend_response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing endpoints: {e}")

if __name__ == "__main__":
    # Start server in background thread
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()
    
    # Wait for server to start
    print("Starting server...")
    time.sleep(8)  # Give server time to fully initialize
    
    # Test endpoints
    test_endpoints()
    
    print("\n=== Test completed ===")
    print("You can now visit http://127.0.0.1:8000 to see the frontend")