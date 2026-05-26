from pymongo import MongoClient
client = MongoClient("mongodb://localhost:27017/")
db = client["clickup_clone"]
founder = db["users"].find_one({"role": "founder"})
if founder:
    print(f"Found founder: {founder['email']}")
else:
    print("No founder found")
