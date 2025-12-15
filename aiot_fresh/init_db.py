#!/usr/bin/env python3
"""
init_db.py
Initialize canonical SQLite DB for AIoT Fresh Monitor at aiot_fresh/aiot.db
Creates tables:
 - food_types
 - containers
 - telemetry
 - alerts
 - change_log
 - outbox
 - users
Idempotent: safe to run multiple times.
"""

import os
import sqlite3
import json
from datetime import datetime

# Use a local path for development to avoid permission issues
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "aiot.db")

def ensure_dir():
    # Directory is guaranteed to exist since it's the current script's directory
    pass

def connect():
    return sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES|sqlite3.PARSE_COLNAMES)

def init_schema(conn):
    cur = conn.cursor()

    # food_types table: id TEXT PRIMARY KEY, display_name, thresholds JSON, notes
    cur.execute("""
    CREATE TABLE IF NOT EXISTS food_types (
        id TEXT PRIMARY KEY,
        display_name TEXT,
        thresholds TEXT, -- JSON string
        notes TEXT
    );
    """)

    # containers: device_id PK, selected_food_type, threshold_overrides JSON, last_seen TEXT
    cur.execute("""
    CREATE TABLE IF NOT EXISTS containers (
        device_id TEXT PRIMARY KEY,
        selected_food_type TEXT,
        threshold_overrides TEXT, -- JSON string
        last_seen TEXT,
        last_modified TEXT,
        source TEXT
    );
    """)

    # telemetry: stores raw telemetry; synced=0/1 indicates uploaded to cloud
    cur.execute("""
    CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        timestamp TEXT,
        temperature_c REAL,
        humidity_pct REAL,
        mq4_ppm REAL,
        lat REAL,
        lon REAL,
        fix INTEGER,
        satellites INTEGER,
        received_at TEXT,
        synced INTEGER DEFAULT 0
    );
    """)

    # alerts: local alerts created by Pi (before push to cloud)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        container_id TEXT,
        alert_type TEXT,
        level TEXT, -- warn/critical
        message TEXT,
        timestamp TEXT,
        resolved INTEGER DEFAULT 0,
        pushed INTEGER DEFAULT 0
    );
    """)

    # change_log: per spec
    cur.execute("""
    CREATE TABLE IF NOT EXISTS change_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        user TEXT,
        action TEXT,
        before TEXT, -- JSON
        after TEXT,  -- JSON
        timestamp TEXT,
        source TEXT
    );
    """)

    # outbox: queue of actions (telemetry/alerts/config) to push to Firestore when online
    cur.execute("""
    CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT, -- telemetry|alert|config
        target_path TEXT, -- Firestore path or descriptive
        payload TEXT, -- JSON
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT
    );
    """)

    # users table: for portal login
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    );
    """)

    conn.commit()

def seed_defaults(conn):
    cur = conn.cursor()

    # Check if any food_types exist; if none, insert sample food types
    cur.execute("SELECT COUNT(1) FROM food_types")
    count = cur.fetchone()[0]
    if count == 0:
        sample = [
            {
                "id": "bananas",
                "display_name": "Bananas",
                "thresholds": {
                    "temperature": {"warn": 13.0, "critical": 20.0},
                    "humidity": {"warn_low": 50.0, "warn_high": 95.0}
                },
                "notes": "Example thresholds for bananas"
            },
            {
                "id": "chicken",
                "display_name": "Chicken (raw)",
                "thresholds": {
                    "temperature": {"warn": 2.0, "critical": 4.0},
                    "humidity": {"warn_low": 60.0, "warn_high": 95.0}
                },
                "notes": "Perishable meat"
            }
        ]
        for item in sample:
            cur.execute("""
            INSERT OR IGNORE INTO food_types (id, display_name, thresholds, notes)
            VALUES (?, ?, ?, ?)
            """, (item["id"], item["display_name"], json.dumps(item["thresholds"]), item["notes"]))
        conn.commit()
        print("Seeded sample food_types")
    else:
        print("food_types already present; skipping seed")

def main():
    print("Initializing AIoT SQLite DB at", DB_PATH)
    ensure_dir()
    conn = connect()
    init_schema(conn)
    seed_defaults(conn)
    conn.close()
    print("Initialization complete.")

if __name__ == "__main__":
    main()
