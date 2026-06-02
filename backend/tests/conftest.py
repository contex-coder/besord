import os
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

# Use the public backend URL (frontend's env points to the deployed preview)
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://image-feedback-app.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

TEST_USER_ID = "user_test_pytest_001"
TEST_SESSION_TOKEN = "test_token_pytest_abc123"
TEST_EMAIL = "TEST_pytest@example.com"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    cli = MongoClient(MONGO_URL)
    db = cli[DB_NAME]
    yield db
    cli.close()


@pytest.fixture(scope="session")
def seeded_user(mongo_db):
    """Insert test user + session directly into Mongo to bypass OAuth."""
    # cleanup any leftover
    mongo_db.users.delete_many({"user_id": TEST_USER_ID})
    mongo_db.users.delete_many({"email": TEST_EMAIL})
    mongo_db.user_sessions.delete_many({"session_token": TEST_SESSION_TOKEN})

    mongo_db.users.insert_one({
        "user_id": TEST_USER_ID,
        "email": TEST_EMAIL,
        "name": "Test User",
        "picture": None,
        "created_at": datetime.now(timezone.utc),
    })
    mongo_db.user_sessions.insert_one({
        "session_token": TEST_SESSION_TOKEN,
        "user_id": TEST_USER_ID,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })

    yield {"user_id": TEST_USER_ID, "session_token": TEST_SESSION_TOKEN, "email": TEST_EMAIL}

    # teardown
    mongo_db.users.delete_many({"user_id": TEST_USER_ID})
    mongo_db.user_sessions.delete_many({"session_token": TEST_SESSION_TOKEN})
    mongo_db.posts.delete_many({"author_id": TEST_USER_ID})
    mongo_db.votes.delete_many({"user_id": TEST_USER_ID})


@pytest.fixture(scope="session")
def auth_headers(seeded_user):
    return {"Authorization": f"Bearer {seeded_user['session_token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(autouse=True)
def _auto_verify_workspaces_pretest(request, mongo_db):
    """Mark all business workspaces of the test user as verified before each test
    (except iter18, which tests the verification flow itself)."""
    if "iteration18" in request.node.nodeid:
        yield
        return
    mongo_db.workspaces.update_many(
        {"type": "business"},
        {"$set": {"verified": True}},
    )
    yield
