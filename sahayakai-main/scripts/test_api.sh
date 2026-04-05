
#!/bin/bash

BASE_URL="http://localhost:3050"
TEST_UID="test-swagger-user-500"

echo "Using UID: $TEST_UID"

# 1. Create User
echo "\n\n--- TEST 1: Creating User Profile ---"
curl -i -X POST "$BASE_URL/api/user/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "'"$TEST_UID"'",
    "email": "tester@example.com",
    "displayName": "Swagger Tester",
    "schoolName": "Demo Academy",
    "teachingGradeLevels": ["Class 9", "Class 10"],
    "subjects": ["Science"],
    "preferredLanguage": "English"
  }'

# 2. Save Content (Valid)
echo "\n\n--- TEST 2: Saving VALID Content ---"
curl -i -X POST "$BASE_URL/api/content/save" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $TEST_UID" \
  -d '{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "type": "lesson-plan",
    "title": "Photosynthesis Demo",
    "gradeLevel": "Class 9",
    "subject": "Science",
    "topic": "Photosynthesis",
    "language": "English",
    "isPublic": false,
    "isDraft": true,
    "createdAt": "2026-02-05T10:00:00Z",
    "data": {
        "metadata": {
            "duration": "45 mins",
            "objectives": ["Understand Sunlight usage"],
            "materials": ["Plant", "Sun"]
        },
        "content": {
            "engage": [], 
            "explore": [],
            "explain": [],
            "elaborate": [],
            "evaluate": []
        },
        "teacherSupport": {
            "tips": "Be patient",
            "keyVocabulary": [{"term": "Chlorophyll", "definition": "Green pigment"}],
            "blackboardWork": ["Draw a leaf"]
        },
        "assessment": "Quiz at end",
        "homework": "Read chapter 5"
    }
  }'

# 3. Save Content (Invalid - Missing 'gradeLevel')
echo "\n\n--- TEST 3: Saving INVALID Content (Should Fail) ---"
curl -i -X POST "$BASE_URL/api/content/save" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $TEST_UID" \
  -d '{
    "id": "123e4567-e89b-12d3-a456-426614174099",
    "type": "lesson-plan",
    "title": "Bad Request Demo",
    "subject": "Science",
    "topic": "Fail",
    "language": "English",
    "data": {} 
  }'
