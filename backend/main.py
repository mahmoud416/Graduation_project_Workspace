"""
FastAPI application entry point.
Multi-team SaaS backend with RBAC and JWT authentication.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo_connection, get_database
from app.db.collections import create_indexes
from app.routes import (
    auth,
    teams,
    memberships,
    tasks,
    projects,
    users,
    task_boards,
    ws,
    notifications,
    upload_rules,
    events,
    quality,
    qc,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup: Connect to MongoDB and create indexes
    await connect_to_mongo()
    db = get_database()
    await create_indexes(db)
    
    yield
    
    # Shutdown: Close MongoDB connection
    await close_mongo_connection()


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-team SaaS backend with Role-Based Access Control",
    lifespan=lifespan
)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(teams.router, prefix="/api/v1")
app.include_router(memberships.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(task_boards.router, prefix="/api/v1")
app.include_router(ws.router)
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(upload_rules.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(quality.router, prefix="/api/v1")
app.include_router(qc.router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint - API health check."""
    return {
        "message": "ClickUp-like SaaS Backend API",
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
