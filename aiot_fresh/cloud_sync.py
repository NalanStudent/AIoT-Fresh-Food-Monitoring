import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import sqlite3
import json
import time
import os
from datetime import datetime

# --- Configuration ---
# Path to your Firebase service account key
SERVICE_ACCOUNT_KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "serviceAccount.json")
# Firebase Project ID (extracted from serviceAccount.json)
FIREBASE_PROJECT_ID = "aiot-fresh-monitor" 

# SQLite DB Path
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aiot.db")

# Sync interval in seconds
SYNC_INTERVAL = 10 
# Max retries for each outbox item before giving up (or marking for manual review)
MAX_RETRIES = 5

# --- Firebase Initialization ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        firebase_admin.initialize_app(cred, {
            'projectId': FIREBASE_PROJECT_ID,
        })
    db = firestore.client()
    print("Firebase initialized successfully.")
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    db = None # Ensure db is None if init failed

# --- SQLite Helper Functions ---
def get_db_connection():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
    except sqlite3.Error as e:
        print(f"Database connection error: {e}")
    return conn

def get_outbox_items(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outbox WHERE attempts < ? ORDER BY created_at ASC", (MAX_RETRIES,))
    return cursor.fetchall()

def delete_outbox_item(conn, item_id):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM outbox WHERE id = ?", (item_id,))
    conn.commit()

def update_outbox_item_on_failure(conn, item_id, error_message):
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE outbox
        SET attempts = attempts + 1, last_error = ?
        WHERE id = ?
    """, (error_message, item_id))
    conn.commit()

# --- Sync Logic ---
def sync_telemetry(payload, target_path):
    if not db:
        raise Exception("Firebase not initialized.")
    
    # New Path: target_path is now "{containerId}/telemetry"
    # New ID: The document ID is the timestamp from the payload
    doc_id = payload.get("timestamp")
    if not doc_id:
        raise ValueError("Telemetry payload missing timestamp for use as document ID.")
        
    # The collection path is the target_path from the outbox
    doc_ref = db.collection(target_path).document(doc_id)
    doc_ref.set(payload)
    print(f"Synced telemetry to {doc_ref.path}")

def sync_alert(payload, target_path):
    if not db:
        raise Exception("Firebase not initialized.")
    
    # New Path: target_path is now "{containerId}/alerts"
    # New ID: The document ID is the timestamp from the payload
    doc_id = payload.get("timestamp")
    if not doc_id:
        raise ValueError("Alert payload missing timestamp for use as document ID.")

    # The collection path is the target_path from the outbox
    doc_ref = db.collection(target_path).document(doc_id)
    doc_ref.set(payload)
    print(f"Synced alert to {doc_ref.path}")

def sync_config(payload, target_path):
    if not db:
        raise Exception("Firebase not initialized.")
    
    # target_path would be 'containers/{containerId}'
    # The payload is the config object for the container
    container_id = payload.get("device_id")
    if not container_id:
        raise ValueError("Config payload missing device_id")
    
    doc_ref = db.collection('containers').document(container_id)
    # Only update the relevant fields for config (threshold_overrides, selected_food_type, etc.)
    # The Pi is authoritative, so it can overwrite.
    update_data = {
        "selected_food_type": payload.get("selected_food_type"),
        "threshold_overrides": payload.get("threshold_overrides"),
        "last_modified": payload.get("last_modified"),
        "source": payload.get("source"),
        # Potentially other container metadata if decided later
    }
    doc_ref.set(update_data, merge=True) # Use merge=True to only update specified fields
    print(f"Synced config for {container_id} to {doc_ref.path}")

def sync_container_summary(payload, target_path):
    """Handles the 'container_summary' kind to update the main container doc."""
    if not db:
        raise Exception("Firebase not initialized.")
    
    # target_path will be "containers/{container_id}"
    doc_ref = db.document(target_path)
    doc_ref.update(payload) # Use update to merge the new summary data
    print(f"Synced container summary to {doc_ref.path}")

def process_outbox_item(conn, item):
    item_id = item["id"]
    kind = item["kind"]
    target_path = item["target_path"]
    payload = json.loads(item["payload"])

    try:
        if kind == "telemetry":
            sync_telemetry(payload, target_path)
        elif kind == "alert":
            sync_alert(payload, target_path)
        elif kind == "config":
            sync_config(payload, target_path)
        elif kind == "container_summary":
            sync_container_summary(payload, target_path)
        else:
            print(f"Unknown item kind in outbox: {kind}. Deleting item {item_id}.")
            delete_outbox_item(conn, item_id)
            return

        delete_outbox_item(conn, item_id)
        print(f"Successfully synced and removed outbox item {item_id} ({kind})")

    except Exception as e:
        error_message = str(e)
        print(f"Failed to sync outbox item {item_id} ({kind}): {error_message}")
        update_outbox_item_on_failure(conn, item_id, error_message)
        if db is None: # If Firebase is not initialized, assume no connectivity
            print("Firebase is not initialized. Assuming no internet connectivity.")
            # Re-raise to ensure the main loop doesn't try to sync other items if there's a fundamental issue
            raise e 

def main_sync_loop():
    while True:
        conn = None
        try:
            conn = get_db_connection()
            if not conn:
                print("Could not get DB connection. Retrying...")
                time.sleep(SYNC_INTERVAL)
                continue

            items = get_outbox_items(conn)
            if items:
                print(f"Found {len(items)} items in outbox to sync.")
                for item in items:
                    process_outbox_item(conn, item)
            else:
                print("Outbox is empty. Waiting for new items...")

        except Exception as e:
            print(f"Main sync loop error: {e}")
            # If a sync failure indicates broader connectivity issues (e.g., Firebase init failed),
            # wait longer before retrying to avoid spamming logs/retries.
            if "Firebase not initialized" in str(e):
                time.sleep(SYNC_INTERVAL * 5) # Longer wait if Firebase is down
            else:
                time.sleep(SYNC_INTERVAL)
        finally:
            if conn:
                conn.close()
        
        time.sleep(SYNC_INTERVAL)

if __name__ == "__main__":
    print("Starting Cloud Sync Service...")
    main_sync_loop()
