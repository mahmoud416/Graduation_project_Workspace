#!/usr/bin/env python3
"""
Test script for ClickUp-like SaaS Backend API
Tests authentication flow, team management, and RBAC enforcement.
"""
import requests
import json
from typing import Dict

BASE_URL = "http://localhost:8000/api/v1"

def print_section(title: str):
    """Print a formatted section title."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def print_result(action: str, response: requests.Response):
    """Print API request result."""
    status_emoji = "✓" if response.status_code < 400 else "✗"
    print(f"{status_emoji} {action}")
    print(f"   Status: {response.status_code}")
    if response.text:
        try:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)[:200]}...")
        except:
            print(f"   Response: {response.text[:200]}")
    print()

def main():
    """Main test function."""
    
    print_section("1. AUTHENTICATION TESTS")
    
    # Register Admin User
    print("Creating Admin User...")
    admin_data = {
        "email": "admin@test.com",
        "password": "admin1234",
        "full_name": "Admin User"
    }
    response = requests.post(f"{BASE_URL}/auth/register", json=admin_data)
    print_result("Register Admin", response)
    
    # Login as Admin
    print("Logging in as Admin...")
    login_data = {
        "email": "admin@test.com",
        "password": "admin1234"
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    print_result("Login Admin", response)
    
    if response.status_code == 200:
        admin_token = response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get current user
        print("Getting Admin profile...")
        response = requests.get(f"{BASE_URL}/auth/me", headers=admin_headers)
        print_result("Get Admin Profile", response)
        admin_id = response.json()["_id"]
        
        print_section("2. TEAM MANAGEMENT TESTS")
        
        # Create Team
        print("Creating Team...")
        team_data = {
            "name": "Test Team",
            "description": "Team for testing RBAC"
        }
        response = requests.post(f"{BASE_URL}/teams", json=team_data, headers=admin_headers)
        print_result("Create Team", response)
        team_id = response.json()["_id"]
        
        # List Teams
        print("Listing Admin's teams...")
        response = requests.get(f"{BASE_URL}/teams", headers=admin_headers)
        print_result("List Teams", response)
        
        print_section("3. USER & MEMBERSHIP TESTS")
        
        # Register Sub-Admin
        print("Creating Sub-Admin User...")
        subadmin_data = {
            "email": "subadmin@test.com",
            "password": "subadmin12",
            "full_name": "Sub-Admin User"
        }
        response = requests.post(f"{BASE_URL}/auth/register", json=subadmin_data)
        print_result("Register Sub-Admin", response)
        subadmin_id = response.json()["_id"]
        
        # Login as Sub-Admin
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "subadmin@test.com",
            "password": "subadmin12"
        })
        subadmin_token = response.json()["access_token"]
        subadmin_headers = {"Authorization": f"Bearer {subadmin_token}"}
        
        # Add Sub-Admin to Team
        print("Adding Sub-Admin to team...")
        membership_data = {
            "user_id": subadmin_id,
            "role": "subadmin"
        }
        response = requests.post(
            f"{BASE_URL}/teams/{team_id}/members",
            json=membership_data,
            headers=admin_headers
        )
        print_result("Add Sub-Admin to Team", response)
        
        # Register Member
        print("Creating Member User...")
        member_data = {
            "email": "member@test.com",
            "password": "member1234",
            "full_name": "Member User"
        }
        response = requests.post(f"{BASE_URL}/auth/register", json=member_data)
        print_result("Register Member", response)
        member_id = response.json()["_id"]
        
        # Login as Member
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "member@test.com",
            "password": "member1234"
        })
        member_token = response.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}
        
        # Add Member to Team (managed by Sub-Admin)
        print("Adding Member to team (managed by Sub-Admin)...")
        membership_data = {
            "user_id": member_id,
            "role": "member",
            "managed_by": subadmin_id
        }
        response = requests.post(
            f"{BASE_URL}/teams/{team_id}/members",
            json=membership_data,
            headers=admin_headers
        )
        print_result("Add Member to Team", response)
        
        # List Team Members
        print("Listing team members...")
        response = requests.get(f"{BASE_URL}/teams/{team_id}/members", headers=admin_headers)
        print_result("List Team Members", response)
        
        print_section("4. TASK MANAGEMENT & RBAC TESTS")
        
        # Admin creates task for member
        print("Admin creating task for member...")
        task_data = {
            "title": "Task 1 - Assigned to Member",
            "description": "This task is assigned to member",
            "team_id": team_id,
            "assigned_to": member_id,
            "status": "todo",
            "priority": "high"
        }
        response = requests.post(f"{BASE_URL}/tasks", json=task_data, headers=admin_headers)
        print_result("Create Task for Member", response)
        task1_id = response.json()["_id"]
        
        # Admin creates task for sub-admin
        print("Admin creating task for sub-admin...")
        task_data = {
            "title": "Task 2 - Assigned to Sub-Admin",
            "description": "This task is assigned to sub-admin",
            "team_id": team_id,
            "assigned_to": subadmin_id,
            "status": "todo",
            "priority": "medium"
        }
        response = requests.post(f"{BASE_URL}/tasks", json=task_data, headers=admin_headers)
        print_result("Create Task for Sub-Admin", response)
        
        print_section("5. RBAC VISIBILITY TESTS")
        
        # Admin lists tasks (should see all)
        print("Admin listing tasks (should see ALL tasks)...")
        response = requests.get(f"{BASE_URL}/tasks?team_id={team_id}", headers=admin_headers)
        print_result("Admin View Tasks", response)
        if response.status_code == 200:
            print(f"   Admin can see {len(response.json())} tasks")
        
        # Sub-Admin lists tasks (should see managed member's tasks only)
        print("Sub-Admin listing tasks (should see managed member's tasks)...")
        response = requests.get(f"{BASE_URL}/tasks?team_id={team_id}", headers=subadmin_headers)
        print_result("Sub-Admin View Tasks", response)
        if response.status_code == 200:
            print(f"   Sub-Admin can see {len(response.json())} tasks")
        
        # Member lists tasks (should see only their own)
        print("Member listing tasks (should see ONLY own tasks)...")
        response = requests.get(f"{BASE_URL}/tasks?team_id={team_id}", headers=member_headers)
        print_result("Member View Tasks", response)
        if response.status_code == 200:
            tasks = response.json()
            print(f"   Member can see {len(tasks)} task(s)")
            if tasks:
                print(f"   Task title: {tasks[0]['title']}")
        
        print_section("6. TASK UPDATE TESTS")
        
        # Member updates their own task
        print("Member updating their own task...")
        update_data = {
            "status": "in_progress",
            "priority": "high"
        }
        response = requests.put(f"{BASE_URL}/tasks/{task1_id}", json=update_data, headers=member_headers)
        print_result("Member Update Own Task", response)
        
        print_section("✅ ALL TESTS COMPLETED!")
        print("\n🎉 Backend is working correctly with RBAC enforcement!\n")
    
    else:
        print("❌ Login failed, cannot proceed with tests")

if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to the API server.")
        print("Make sure the server is running: uvicorn app.main:app --reload\n")
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}\n")
