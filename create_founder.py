import requests
from pymongo import MongoClient
import sys

# Register
res = requests.post("http://localhost:8000/api/v1/auth/register", json={
    "email": "founder@example.com",
    "password": "password123",
    "full_name": "System Founder"
})
if res.status_code not in (200, 201):
    print("Registration failed:", res.text)
    
# Change role
client = MongoClient("mongodb://localhost:27017/")
db = client["clickup_clone"]
db["users"].update_one(
    {"email": "founder@example.com"}, 
    {"$set": {"role": "founder", "roles": ["founder"]}}
)
print("Founder created successfully.")
