import sqlite3
import bcrypt
from flask import session, redirect, url_for
import os

# Use a local path for development to avoid permission issues
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aiot.db")

def get_db():
    return sqlite3.connect(DB_PATH)

def verify_login(username, password):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT password_hash FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    conn.close()
    if row is None:
        return False
    stored_hash = row[0]
    return bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))

def require_auth(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrapper