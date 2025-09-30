#!/usr/bin/env python3
"""
CourseScout Deployment Status Checker
Monitors Vercel deployment and API functionality
"""

import requests
import time
import json
from datetime import datetime

def check_deployment_status():
    """Check if the CourseScout API deployment is working correctly"""
    
    api_base_url = "https://course-review-recommendation-engine.onrender.com"
    frontend_url = "https://coursescout.vercel.app"
    
    print("🚀 CHECKING COURSESCOUT API DEPLOYMENT (RENDER)")
    print("=" * 50)
    print(f"API Target: {api_base_url}")
    print(f"Frontend: {frontend_url}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test results storage
    results = {
        "timestamp": datetime.now().isoformat(),
        "api_base_url": api_base_url,
        "frontend_url": frontend_url,
        "tests": {}
    }
    
    # 1. Health Check
    print("1. 🔍 API HEALTH CHECK")
    try:
        response = requests.get(f"{api_base_url}/api", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Status: {data.get('status', 'unknown')}")
            print(f"   ✅ Message: {data.get('message', 'No message')}")
            results["tests"]["health"] = {"status": "pass", "data": data}
        else:
            print(f"   ❌ Health check failed: HTTP {response.status_code}")
            results["tests"]["health"] = {"status": "fail", "error": f"HTTP {response.status_code}"}
            results["overall_status"] = "failed"
            return results
    except Exception as e:
        print(f"   ❌ Health check error: {e}")
        results["tests"]["health"] = {"status": "error", "error": str(e)}
        results["overall_status"] = "failed"
        return results
    
    # 2. Trending Courses
    print("\n2. 📈 TRENDING COURSES")
    try:
        response = requests.get(f"{api_base_url}/trending", timeout=10)
        if response.status_code == 200:
            courses = response.json()
            if isinstance(courses, list) and len(courses) > 0:
                print(f"   ✅ Found {len(courses)} trending courses")
                print(f"   ✅ Top course: '{courses[0].get('title', 'Unknown')}' by {courses[0].get('visible_instructors', [{}])[0].get('name', 'Unknown')}")
                print(f"   ✅ Rating: {courses[0].get('rating', 'N/A')}")
                results["tests"]["trending"] = {"status": "pass", "count": len(courses), "sample": courses[0].get('title')}
            else:
                print(f"   ❌ No trending courses returned")
                results["tests"]["trending"] = {"status": "fail", "error": "Empty response"}
        else:
            print(f"   ❌ Trending failed: HTTP {response.status_code}")
            results["tests"]["trending"] = {"status": "fail", "error": f"HTTP {response.status_code}"}
    except Exception as e:
        print(f"   ❌ Trending error: {e}")
        results["tests"]["trending"] = {"status": "error", "error": str(e)}
    
    # 3. Search Functionality
    print("\n3. 🔍 SEARCH FUNCTIONALITY")
    search_queries = ["python", "javascript", "web development"]
    for query in search_queries:
        try:
            response = requests.get(f"{api_base_url}/search?query={query}", timeout=10)
            if response.status_code == 200:
                courses = response.json()
                if isinstance(courses, list) and len(courses) > 0:
                    print(f"   ✅ '{query}': {len(courses)} courses found")
                    results["tests"][f"search_{query.replace(' ', '_')}"] = {"status": "pass", "count": len(courses)}
                else:
                    print(f"   ⚠️  '{query}': No courses found")
                    results["tests"][f"search_{query.replace(' ', '_')}"] = {"status": "pass", "count": 0}
            else:
                print(f"   ❌ '{query}': HTTP {response.status_code}")
                results["tests"][f"search_{query.replace(' ', '_')}"] = {"status": "fail", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            print(f"   ❌ '{query}': {e}")
            results["tests"][f"search_{query.replace(' ', '_')}"] = {"status": "error", "error": str(e)}
    
    # 4. Top Rated Courses
    print("\n4. ⭐ TOP RATED COURSES")
    try:
        response = requests.get(f"{api_base_url}/top-rated", timeout=10)
        if response.status_code == 200:
            courses = response.json()
            if isinstance(courses, list) and len(courses) > 0:
                print(f"   ✅ Found {len(courses)} top-rated courses")
                print(f"   ✅ Top course: '{courses[0].get('title', 'Unknown')}' (Rating: {courses[0].get('rating', 'N/A')})")
                results["tests"]["top_rated"] = {"status": "pass", "count": len(courses), "sample": courses[0].get('title')}
            else:
                print(f"   ❌ No top-rated courses returned")
                results["tests"]["top_rated"] = {"status": "fail", "error": "Empty response"}
        else:
            print(f"   ❌ Top-rated failed: HTTP {response.status_code}")
            results["tests"]["top_rated"] = {"status": "fail", "error": f"HTTP {response.status_code}"}
    except Exception as e:
        print(f"   ❌ Top-rated error: {e}")
        results["tests"]["top_rated"] = {"status": "error", "error": str(e)}
    
    # 5. AI Recommendations
    print("\n5. 🤖 AI RECOMMENDATIONS")
    try:
        # Use a sample course ID from trending
        trending_response = requests.get(f"{api_base_url}/trending", timeout=10)
        if trending_response.status_code == 200:
            trending = trending_response.json()
            if len(trending) > 0:
                course_id = trending[0].get('id')
                if course_id:
                    response = requests.get(f"{api_base_url}/recommendations?course_id={course_id}", timeout=10)
                    if response.status_code == 200:
                        recs = response.json()
                        if isinstance(recs, list) and len(recs) > 0:
                            print(f"   ✅ Found {len(recs)} recommendations for course ID {course_id}")
                            results["tests"]["recommendations"] = {"status": "pass", "count": len(recs)}
                        else:
                            print(f"   ⚠️  No recommendations found for course ID {course_id}")
                            results["tests"]["recommendations"] = {"status": "pass", "count": 0}
                    else:
                        print(f"   ❌ Recommendations failed: HTTP {response.status_code}")
                        results["tests"]["recommendations"] = {"status": "fail", "error": f"HTTP {response.status_code}"}
                else:
                    print("   ❌ No course ID found in trending data")
                    results["tests"]["recommendations"] = {"status": "fail", "error": "No course ID"}
        else:
            print("   ❌ Could not get trending data for recommendations test")
            results["tests"]["recommendations"] = {"status": "fail", "error": "No trending data"}
    except Exception as e:
        print(f"   ❌ Recommendations error: {e}")
        results["tests"]["recommendations"] = {"status": "error", "error": str(e)}
    
    # 6. Frontend Loading
    print("\n6. 🌐 FRONTEND")
    try:
        response = requests.get(frontend_url, timeout=10)
        if response.status_code == 200:
            html = response.text
            if "CourseScout" in html and len(html) > 10000:
                print(f"   ✅ Frontend loaded successfully ({len(html):,} characters)")
                results["tests"]["frontend"] = {"status": "pass", "size": len(html)}
            else:
                print(f"   ❌ Frontend incomplete ({len(html)} characters)")
                results["tests"]["frontend"] = {"status": "fail", "error": f"Incomplete content: {len(html)} chars"}
        else:
            print(f"   ❌ Frontend failed: HTTP {response.status_code}")
            results["tests"]["frontend"] = {"status": "fail", "error": f"HTTP {response.status_code}"}
    except Exception as e:
        print(f"   ❌ Frontend error: {e}")
        results["tests"]["frontend"] = {"status": "error", "error": str(e)}
    
    # Summary
    print("\n" + "=" * 50)
    passed_tests = sum(1 for test in results["tests"].values() if test["status"] == "pass")
    total_tests = len(results["tests"])
    
    if passed_tests == total_tests:
        print(f"✅ ALL TESTS PASSED ({passed_tests}/{total_tests})")
        print("🎉 COURSESCOUT IS FULLY FUNCTIONAL ON VERCEL!")
        results["overall_status"] = "success"
    else:
        print(f"⚠️  TESTS: {passed_tests}/{total_tests} PASSED")
        if passed_tests >= total_tests * 0.8:  # 80% pass rate
            print("🟡 COURSESCOUT IS MOSTLY FUNCTIONAL")
            results["overall_status"] = "partial"
        else:
            print("❌ COURSESCOUT HAS SIGNIFICANT ISSUES")
            results["overall_status"] = "failed"
    
    return results

if __name__ == "__main__":
    results = check_deployment_status()
    
    # Save results to file
    with open("deployment_status.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Results saved to deployment_status.json")
    
    # Exit with appropriate code
    if results["overall_status"] == "success":
        exit(0)
    elif results["overall_status"] == "partial":
        exit(1)
    else:
        exit(2)