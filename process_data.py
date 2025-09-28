"""
Course Data Processing Script
Converts raw Udemy dataset into optimized format for CourseMate
"""

import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_text(text):
    """Clean and normalize text data"""
    if pd.isna(text):
        return ""
    text = str(text)
    # Remove extra whitespace and newlines
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def estimate_duration_from_curriculum(curriculum):
    """Estimate course duration from curriculum content"""
    if pd.isna(curriculum) or not curriculum:
        return "Self-paced"
    
    # Count topics/modules as rough duration estimate
    curriculum_str = str(curriculum)
    topic_count = len(curriculum_str.split(','))
    
    if topic_count < 10:
        return "1-3 hours"
    elif topic_count < 30:
        return "4-10 hours"
    elif topic_count < 100:
        return "11-50 hours"
    else:
        return "50+ hours"

def process_udemy_data(input_file, output_file):
    """Process Udemy dataset into CourseMate format"""
    logger.info(f"Loading Udemy dataset from {input_file}")
    
    # Load the raw dataset
    df = pd.read_csv(input_file)
    logger.info(f"Loaded {len(df)} courses")
    
    # Create processed dataset with required fields
    processed_courses = []
    
    for idx, row in df.iterrows():
        if idx % 10000 == 0:
            logger.info(f"Processed {idx}/{len(df)} courses...")
        
        # Create course record with all required fields
        course = {
            'id': row.get('id', idx),
            'title': clean_text(row.get('title', 'Untitled Course')),
            'instructor': clean_text(row.get('instructor_names', 'Unknown Instructor')),
            'duration': estimate_duration_from_curriculum(row.get('curriculum')),
            'price': 'Free' if row.get('is_paid', True) == False else 'Paid',
            'rating': float(row.get('rating', 0)) if pd.notna(row.get('rating')) else 0.0,
            'category': clean_text(row.get('category', 'General')),
            'description': clean_text(f"{row.get('headline', '')} {row.get('objectives', '')}"),
            'url': clean_text(row.get('url', '')),
            'language': 'English',  # Assume English for Udemy courses
            'level': clean_text(row.get('instructional_level', 'All Levels')),
            'num_subscribers': int(row.get('num_subscribers', 0)) if pd.notna(row.get('num_subscribers')) else 0,
            'num_reviews': int(row.get('num_reviews', 0)) if pd.notna(row.get('num_reviews')) else 0,
            'headline': clean_text(row.get('headline', '')),
            'objectives': clean_text(row.get('objectives', '')),
            'curriculum': clean_text(row.get('curriculum', '')),
            'is_paid': bool(row.get('is_paid', True)),
            'image_url': f"https://img-c.udemycdn.com/course/240x135/{row.get('id', 'default')}_480x270.jpg"
        }
        
        processed_courses.append(course)
    
    # Convert to DataFrame
    processed_df = pd.DataFrame(processed_courses)
    
    # Add some data quality improvements
    processed_df['rating'] = processed_df['rating'].fillna(0.0)
    processed_df['num_subscribers'] = processed_df['num_subscribers'].fillna(0)
    processed_df['category'] = processed_df['category'].fillna('General')
    
    # Save as feather for fast loading (binary format)
    feather_file = output_file.replace('.csv', '.feather')
    processed_df.to_feather(feather_file)
    logger.info(f"Saved processed data as feather: {feather_file}")
    
    # Also save as CSV for inspection
    processed_df.to_csv(output_file, index=False)
    logger.info(f"Saved processed data as CSV: {output_file}")
    
    return processed_df

def create_course_embeddings(df, embeddings_file):
    """Create TF-IDF embeddings for course similarity"""
    logger.info("Creating course embeddings...")
    
    # Combine text features for embedding
    text_features = []
    for _, row in df.iterrows():
        combined_text = f"{row['title']} {row['category']} {row['description']} {row['instructor']} {row['level']}"
        text_features.append(combined_text)
    
    # Create TF-IDF vectors
    vectorizer = TfidfVectorizer(
        max_features=5000,
        stop_words='english',
        ngram_range=(1, 2),  # Include bigrams
        min_df=2,  # Ignore very rare terms
        max_df=0.8  # Ignore very common terms
    )
    
    tfidf_matrix = vectorizer.fit_transform(text_features)
    logger.info(f"Created TF-IDF matrix with shape: {tfidf_matrix.shape}")
    
    # Convert to dense numpy array and save as float16 to save space
    embeddings = tfidf_matrix.toarray().astype(np.float16)
    np.save(embeddings_file, embeddings)
    logger.info(f"Saved embeddings to: {embeddings_file}")
    
    # Save vectorizer for potential future use
    import pickle
    vectorizer_file = embeddings_file.replace('.npy', '_vectorizer.pkl')
    with open(vectorizer_file, 'wb') as f:
        pickle.dump(vectorizer, f)
    logger.info(f"Saved vectorizer to: {vectorizer_file}")
    
    return embeddings

def main():
    """Main processing function"""
    input_file = r"C:\Users\AjayM.AJAYS_DEVICE\OneDrive\Desktop\dataest\udemy_courses.csv"
    output_file = "courses_data.csv"
    embeddings_file = "course_embeddings_float16.npy"
    
    # Process the dataset
    df = process_udemy_data(input_file, output_file)
    
    # Create embeddings for similarity search
    embeddings = create_course_embeddings(df, embeddings_file)
    
    logger.info("Data processing completed successfully!")
    logger.info(f"Final dataset shape: {df.shape}")
    logger.info(f"Sample courses:")
    print("\n" + df[['title', 'instructor', 'category', 'rating', 'price']].head().to_string())

if __name__ == "__main__":
    main()