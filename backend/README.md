# ClickUp-like Multi-Team SaaS Backend

A production-ready FastAPI backend for a multi-team SaaS application with comprehensive Role-Based Access Control (RBAC), JWT authentication, and MongoDB database.

## 🎯 Features

- **Multi-Team Architecture**: Users can belong to multiple teams with different roles
- **Hierarchical RBAC**: Admin, Sub-Admin, and Member roles with granular permissions
- **JWT Authentication**: Secure token-based authentication with bcrypt password hashing
- **Task Management**: Create, assign, and manage tasks with role-based visibility
- **Clean Architecture**: Well-organized codebase with clear separation of concerns

## 📋 System Requirements

- Python 3.9+
- MongoDB 5.0+
- pip or conda package manager

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Navigate to project directory
cd /home/ahmed/workspace_management

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and update configuration (especially JWT_SECRET_KEY for production)
nano .env
```

### 3. Start MongoDB

```bash
# Using Docker (recommended)
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or install MongoDB locally
# https://docs.mongodb.com/manual/installation/
```

### 4. Run Application

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

The API will be available at: `http://localhost:8000`

API Documentation (Swagger UI): `http://localhost:8000/docs`

## 📁 Project Structure

```
workspace_management/
├── app/
│   ├── core/               # Core configuration and security
│   │   ├── config.py       # Settings management
│   │   └── security.py     # JWT & password hashing
│   ├── db/                 # Database layer
│   │   ├── mongodb.py      # MongoDB connection
│   │   └── collections.py  # Collection names & indexes
│   ├── models/             # MongoDB document models
│   │   ├── user.py
│   │   ├── team.py
│   │   ├── membership.py
│   │   └── task.py
│   ├── schemas/            # Pydantic request/response schemas
│   │   ├── user.py
│   │   ├── team.py
│   │   ├── membership.py
│   │   └── task.py
│   ├── services/           # Business logic layer
│   │   ├── auth_service.py
│   │   ├── team_service.py
│   │   ├── membership_service.py
│   │   └── task_service.py
│   ├── dependencies/       # FastAPI dependencies
│   │   ├── auth.py         # Authentication
│   │   └── rbac.py         # Role-based access control
│   ├── routes/             # API endpoints
│   │   ├── auth.py
│   │   ├── teams.py
│   │   ├── memberships.py
│   │   └── tasks.py
│   └── main.py             # Application entry point
├── .env                    # Environment variables
├── .env.example            # Environment template
├── requirements.txt        # Python dependencies
└── README.md
```

## 🔑 Authentication Flow

### 1. Register a New User

```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword123",
    "full_name": "John Doe"
  }'
```

### 2. Login

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword123"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 3. Use Token in Requests

```bash
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 👥 Role-Based Access Control (RBAC)

### Roles

1. **Admin**
   - Full permissions across the entire team
   - Can manage all members and their roles
   - Can view and manage all tasks
   - Can update/delete the team

2. **Sub-Admin**
   - Manages specific members assigned to them
   - Can view and manage tasks of their assigned members
   - Cannot manage other Sub-Admins or Admins

3. **Member**
   - Can only view and manage their own tasks
   - Limited team visibility

### Task Visibility Matrix

| Role | Visible Tasks |
|------|--------------|
| Admin | All tasks in the team |
| Sub-Admin | Tasks of users they manage |
| Member | Only their own tasks |

## 🔄 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get JWT token
- `GET /api/v1/auth/me` - Get current user profile

### Teams
- `POST /api/v1/teams` - Create team
- `GET /api/v1/teams` - List user's teams
- `GET /api/v1/teams/{team_id}` - Get team details
- `PUT /api/v1/teams/{team_id}` - Update team (Admin only)
- `DELETE /api/v1/teams/{team_id}` - Delete team (Admin only)

### Memberships
- `POST /api/v1/teams/{team_id}/members` - Add member (Admin)
- `GET /api/v1/teams/{team_id}/members` - List members
- `PUT /api/v1/teams/{team_id}/members/{user_id}` - Update role (Admin)
- `DELETE /api/v1/teams/{team_id}/members/{user_id}` - Remove member

### Tasks
- `POST /api/v1/tasks` - Create task
- `GET /api/v1/tasks?team_id={id}` - List tasks (RBAC filtered)
- `GET /api/v1/tasks/{task_id}` - Get task details
- `PUT /api/v1/tasks/{task_id}` - Update task
- `PATCH /api/v1/tasks/{task_id}/assign` - Reassign task
- `DELETE /api/v1/tasks/{task_id}` - Delete task

## 🗄️ Database Schema

### Collections

#### users
```javascript
{
  _id: ObjectId,
  email: String (unique),
  hashed_password: String,
  full_name: String,
  created_at: DateTime,
  is_active: Boolean
}
```

#### teams
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  created_by: ObjectId (ref: users),
  created_at: DateTime
}
```

#### memberships
```javascript
{
  _id: ObjectId,
  user_id: ObjectId (ref: users),
  team_id: ObjectId (ref: teams),
  role: String (admin|subadmin|member),
  managed_by: ObjectId (ref: users) - optional,
  joined_at: DateTime
}
```
**Indexes**: `(user_id, team_id)` unique compound, `team_id`, `managed_by`

#### tasks
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  team_id: ObjectId (ref: teams),
  assigned_to: ObjectId (ref: users),
  created_by: ObjectId (ref: users),
  status: String (todo|in_progress|done),
  priority: String (low|medium|high),
  created_at: DateTime,
  updated_at: DateTime
}
```
**Indexes**: `team_id`, `assigned_to`, `created_by`

## 🔒 Security Best Practices

1. **JWT Secret**: Always use a strong, random JWT secret in production
2. **Password Hashing**: All passwords are hashed using bcrypt
3. **RBAC Enforcement**: All endpoints enforce role-based permissions
4. **Input Validation**: Pydantic schemas validate all request data
5. **MongoDB Injection Prevention**: Using Motor with proper ObjectId validation

## 🧪 Testing the API

### Example Workflow

1. **Register 3 users** (admin, subadmin, member)
2. **Login as admin** and create a team
3. **Add subadmin** to the team with `subadmin` role
4. **Add member** to the team with `managed_by` pointing to subadmin
5. **Create tasks** assigned to different members
6. **Login as different users** to verify task visibility

### Test with curl or Postman

See the Swagger documentation at `http://localhost:8000/docs` for interactive API testing.

## 📝 Development Timeline (8 Days / 2 Developers)

- **Days 1-2**: Foundation (DB, Config, Security, Models)
- **Days 3-4**: Core Services (Auth, Teams, Memberships, Tasks)
- **Days 5-6**: API Routes (All endpoints)
- **Days 7-8**: RBAC Testing & Refinement

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongosh

# If using Docker
docker ps | grep mongodb
```

### Import Errors
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### JWT Token Issues
- Verify `JWT_SECRET_KEY` is set in `.env`
- Check token expiration time
- Ensure proper Bearer token format: `Authorization: Bearer <token>`

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [PyJWT Documentation](https://pyjwt.readthedocs.io/)
- [Motor (Async MongoDB) Documentation](https://motor.readthedocs.io/)

## 📄 License

This project is part of a SaaS backend implementation for educational/commercial purposes.

---

**Built with ❤️ using FastAPI and MongoDB**
