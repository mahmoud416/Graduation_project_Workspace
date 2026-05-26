from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from app.dependencies.rbac import require_founder
from app.db.mongodb import get_database
from app.db.collections import ENTITIES_COLLECTION, TEAMS_COLLECTION, USERS_COLLECTION
import random
from datetime import datetime, timedelta

router = APIRouter(prefix="/founder", tags=["Founder Dashboard"])

@router.get("/metrics")
async def get_system_metrics(current_user=Depends(require_founder), db=Depends(get_database)):
    # Get total counts
    total_entities = await db[ENTITIES_COLLECTION].count_documents({})
    total_teams = await db[TEAMS_COLLECTION].count_documents({})
    total_users = await db[USERS_COLLECTION].count_documents({})
    
    # Calculate some mock live stats for the wow factor
    active_now = max(1, int(total_users * 0.3) + random.randint(1, 10))
    pending_ai_evals = random.randint(5, 25)
    
    # Calculate SaaS Financials based on Entities
    entities = await db[ENTITIES_COLLECTION].find().to_list(length=None)
    mrr = 0
    tier_distribution = {"Basic": 0, "Pro": 0, "Enterprise": 0}
    
    for ent in entities:
        tier = ent.get("subscription_tier", "Basic")
        if tier in tier_distribution:
            tier_distribution[tier] += 1
            if tier == "Enterprise": mrr += 999
            elif tier == "Pro": mrr += 299
            else: mrr += 49
            
    # Mocking AI Trends (Last 7 days)
    ai_trends = [
        {"day": "Mon", "accepted": random.randint(40, 100), "rejected": random.randint(5, 20)},
        {"day": "Tue", "accepted": random.randint(50, 120), "rejected": random.randint(10, 25)},
        {"day": "Wed", "accepted": random.randint(60, 150), "rejected": random.randint(5, 30)},
        {"day": "Thu", "accepted": random.randint(80, 180), "rejected": random.randint(15, 40)},
        {"day": "Fri", "accepted": random.randint(100, 200), "rejected": random.randint(10, 35)},
        {"day": "Sat", "accepted": random.randint(30, 80), "rejected": random.randint(2, 10)},
        {"day": "Sun", "accepted": random.randint(20, 60), "rejected": random.randint(1, 5)},
    ]
    
    # Mock System Alerts
    system_alerts = [
        {"id": 1, "type": "warning", "message": "Acme Corp is at 95% of their AI quota.", "time": "10 mins ago"},
        {"id": 2, "type": "error", "message": "OpenAI API latency spike detected (1200ms).", "time": "1 hour ago"},
        {"id": 3, "type": "info", "message": "3 new Enterprise subscriptions today.", "time": "3 hours ago"}
    ]
    
    return {
        "platform_health": "100% Operational",
        "total_entities": total_entities,
        "total_teams": total_teams,
        "total_users": total_users,
        "active_now": active_now,
        "pending_ai_evals": pending_ai_evals,
        "avg_quality_score": round(random.uniform(75.5, 92.3), 1),
        "financials": {
            "mrr": mrr,
            "tier_distribution": tier_distribution
        },
        "ai_trends": ai_trends,
        "system_alerts": system_alerts,
        "total_tasks_processed": random.randint(10000, 50000)
    }

@router.get("/audit-logs")
async def get_audit_logs(current_user=Depends(require_founder)):
    # Mocking audit logs for demonstration (In a real system, these would be fetched from an AuditLog collection)
    logs = []
    actions = ["Deleted Project", "Modified Framework Settings", "Assigned IT Staff", "Changed Subscription", "AI Engine Error"]
    entities = ["Global Hospital Tech", "Acme Corp", "EduTech Institute", "FinServe Group"]
    users = ["Admin User", "IT Manager", "Sub-Manager", "System"]
    
    now = datetime.utcnow()
    for i in range(10):
        logs.append({
            "id": f"log_{i}",
            "action": random.choice(actions),
            "entity_name": random.choice(entities),
            "user": random.choice(users),
            "timestamp": (now - timedelta(minutes=random.randint(1, 1000))).isoformat(),
            "status": "success" if random.random() > 0.1 else "failed"
        })
    
    # Sort by timestamp desc
    logs.sort(key=lambda x: x["timestamp"], reverse=True)
    return logs
