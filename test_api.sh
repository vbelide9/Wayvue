curl -X POST http://localhost:3001/api/route \
  -H "Content-Type: application/json" \
  -d '{
    "start": "New York, NY",
    "end": "Philadelphia, PA"
  }' > api_response.json
