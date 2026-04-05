
#!/bin/bash

BASE_URL="http://localhost:3050"
TEST_UID="test-swagger-user-500"

echo "Testing AI Generation (Lesson Plan)..."
echo "This might take 15-30 seconds..."

curl -i -X POST "$BASE_URL/api/ai/lesson-plan" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $TEST_UID" \
  -d '{
    "topic": "Gravity",
    "gradeLevels": ["Class 6"],
    "language": "English",
    "resourceLevel": "low"
  }'
