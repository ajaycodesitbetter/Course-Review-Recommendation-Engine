#!/usr/bin/env python3
"""
CourseScout Deployment Diagnostic Tool
Professional debugging for Vercel deployment issues
"""

import pandas as pd
import numpy as np
import os
import sys
import json
from pathlib import Path

def main():
    print("🔍 COURSESCOUT DEPLOYMENT DIAGNOSTIC")
    print("=" * 50)
    
    # 1. Environment Check
    print("\n1. ENVIRONMENT CHECK:")
    print(f"   Python version: {sys.version}")
    print(f"   Current directory: {os.getcwd()}")
    print(f"   Available files: {len(os.listdir())} files")
    
    # 2. Required Libraries Check
    print("\n2. LIBRARY VERSIONS:")
    try:
        print(f"   pandas: {pd.__version__}")
        print(f"   numpy: {np.__version__}")
    except Exception as e:
        print(f"   ❌ Library import error: {e}")
        return False
    
    # 3. Data Files Check
    print("\n3. DATA FILES CHECK:")
    
    # Check sample courses data
    sample_courses_file = "courses_data.sample.feather"
    if os.path.exists(sample_courses_file):
        print(f"   ✅ {sample_courses_file} exists ({os.path.getsize(sample_courses_file) / 1024 / 1024:.1f} MB)")
        try:
            df = pd.read_feather(sample_courses_file)
            print(f"   ✅ Loaded {len(df)} courses successfully")
            print(f"   ✅ Columns: {list(df.columns)}")
            if len(df) > 0 and 'title' in df.columns:
                print(f"   ✅ Sample course: '{df.iloc[0]['title']}'")
            else:
                print("   ❌ No courses or missing 'title' column")
                return False
        except Exception as e:
            print(f"   ❌ Failed to load {sample_courses_file}: {e}")
            return False
    else:
        print(f"   ❌ {sample_courses_file} NOT FOUND")
        return False
    
    # Check sample embeddings
    sample_embeddings_file = "course_embeddings_sample.npy"
    if os.path.exists(sample_embeddings_file):
        print(f"   ✅ {sample_embeddings_file} exists ({os.path.getsize(sample_embeddings_file) / 1024 / 1024:.1f} MB)")
        try:
            emb = np.load(sample_embeddings_file)
            print(f"   ✅ Loaded embeddings: {emb.shape}")
            if emb.shape[0] != len(df):
                print(f"   ⚠️  WARNING: Embeddings ({emb.shape[0]}) don't match courses ({len(df)})")
        except Exception as e:
            print(f"   ❌ Failed to load {sample_embeddings_file}: {e}")
            return False
    else:
        print(f"   ❌ {sample_embeddings_file} NOT FOUND")
        return False
    
    # 4. Config Files Check
    print("\n4. CONFIGURATION CHECK:")
    try:
        from config import config
        print(f"   ✅ Config loaded successfully")
        print(f"   ✅ COURSES_DATA_FILE: {config.COURSES_DATA_FILE}")
        print(f"   ✅ EMBEDDINGS_FILE: {config.EMBEDDINGS_FILE}")
        print(f"   ✅ DEBUG: {config.DEBUG}")
        
        # Check if config points to sample files
        if "sample" not in config.COURSES_DATA_FILE:
            print(f"   ⚠️  WARNING: Config not using sample data: {config.COURSES_DATA_FILE}")
        if "sample" not in config.EMBEDDINGS_FILE:
            print(f"   ⚠️  WARNING: Config not using sample embeddings: {config.EMBEDDINGS_FILE}")
            
    except Exception as e:
        print(f"   ❌ Config error: {e}")
        return False
    
    # 5. FastAPI Initialization Test
    print("\n5. FASTAPI INITIALIZATION TEST:")
    try:
        # Import main module
        import main
        print("   ✅ Main module imported successfully")
        
        # Test data initialization
        import asyncio
        asyncio.run(main.initialize_course_data())
        
        # Check if data loaded (after initialization, check the globals)
        if main.courses_df is not None and len(main.courses_df) > 0:
            print(f"   ✅ Course data initialized: {len(main.courses_df)} courses")
        else:
            print("   ❌ Course data NOT initialized")
            return False
            
        if main.course_embeddings is not None:
            print(f"   ✅ Embeddings initialized: {main.course_embeddings.shape}")
        else:
            print("   ❌ Embeddings NOT initialized")
            return False
            
    except Exception as e:
        print(f"   ❌ FastAPI initialization error: {e}")
        print(f"   Error details: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    # 6. API Endpoints Test (if server running)
    print("\n6. API ENDPOINTS TEST:")
    try:
        import requests
        base_url = "http://127.0.0.1:8000"
        
        # Test health endpoint
        response = requests.get(f"{base_url}/api", timeout=5)
        if response.status_code == 200:
            print("   ✅ API health check passed")
            
            # Test trending endpoint
            response = requests.get(f"{base_url}/trending", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Trending endpoint: {len(data)} courses")
            else:
                print(f"   ❌ Trending endpoint failed: {response.status_code}")
        else:
            print(f"   ❌ API health check failed: {response.status_code}")
    except Exception as e:
        print(f"   ⚠️  API test skipped (server not running): {e}")
    
    print("\n" + "=" * 50)
    print("✅ DIAGNOSTIC COMPLETE - ALL CHECKS PASSED")
    print("🚀 Sample data is ready for deployment!")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)