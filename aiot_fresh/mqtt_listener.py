import paho.mqtt.client as mqtt
import sqlite3
import json
import time
import os
from datetime import datetime

MQTT_HOST = "localhost"
MQTT_PORT = 1883
MQTT_USERNAME = ""
MQTT_PASSWORD = ""

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aiot.db")

TOPIC = "containers/+/telemetry"
RECONNECT_DELAY = 5


# ---------------------------
# DB Helper Functions
# ---------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_container_if_missing(conn, device_id, food_type="unknown"):
    cursor = conn.cursor()
    cursor.execute("SELECT device_id FROM containers WHERE device_id=?", (device_id,))
    exists = cursor.fetchone()
    if not exists:
        cursor.execute("""
            INSERT INTO containers (device_id, selected_food_type, last_seen, threshold_overrides)
            VALUES (?, ?, ?, ?)
        """, (device_id, food_type, datetime.utcnow().isoformat(), "{}"))
        conn.commit()


def insert_telemetry(conn, device_id, telemetry):
    cursor = conn.cursor()
    gps_data = telemetry.get("gps", {})
    cursor.execute("""
        INSERT INTO telemetry (device_id, timestamp, temperature_c, humidity_pct, mq4_ppm, lat, lon, fix, satellites, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        device_id,
        telemetry.get("timestamp", datetime.utcnow().isoformat()),
        telemetry.get("temperature_c"),
        telemetry.get("humidity_pct"),
        telemetry.get("mq4_ppm"),
        gps_data.get("lat"),
        gps_data.get("lon"),
        gps_data.get("fix"),
        gps_data.get("satellites"),
        datetime.utcnow().isoformat()
    ))
    conn.commit()


def update_container_status(conn, device_id):
    cursor = conn.cursor()
    cursor.execute("UPDATE containers SET last_seen=? WHERE device_id=?", (datetime.utcnow().isoformat(), device_id))
    conn.commit()


def get_merged_thresholds(conn, device_id):
    cursor = conn.cursor()
    cursor.execute("SELECT threshold_overrides FROM containers WHERE device_id=?", (device_id,))
    container_row = cursor.fetchone()
    if not container_row:
        return {}

    overrides = json.loads(container_row["threshold_overrides"]) if container_row["threshold_overrides"] else {}
    return overrides

def evaluate_telemetry(telemetry, thresholds):
    alerts = []
    temp = telemetry.get("temperature_c")
    humidity = telemetry.get("humidity_pct")

    if temp is not None and "temperature" in thresholds:
        if "critical" in thresholds["temperature"] and temp > thresholds["temperature"]["critical"]:
            alerts.append({"type": "temperature", "level": "critical", "message": f"Critical temperature: {temp}°C"})
        elif "warn" in thresholds["temperature"] and temp > thresholds["temperature"]["warn"]:
            alerts.append({"type": "temperature", "level": "warn", "message": f"High temperature: {temp}°C"})

    if humidity is not None and "humidity" in thresholds:
        if "warn_high" in thresholds["humidity"] and humidity > thresholds["humidity"]["warn_high"]:
            alerts.append({"type": "humidity", "level": "warn", "message": f"High humidity: {humidity}%"})
        if "warn_low" in thresholds["humidity"] and humidity < thresholds["humidity"]["warn_low"]:
            alerts.append({"type": "humidity", "level": "warn", "message": f"Low humidity: {humidity}%"})
    
    return alerts

def create_alert(conn, device_id, alert_info):
    cursor = conn.cursor()
    ts = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO alerts (container_id, alert_type, level, message, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, (device_id, alert_info["type"], alert_info["level"], alert_info["message"], ts))
    conn.commit()
    return cursor.lastrowid, ts

def get_active_alerts(conn, device_id):
    """Gets a set of active alerts for a device from the DB."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT alert_type, level FROM alerts WHERE container_id = ? AND resolved = 0",
        (device_id,)
    )
    return {(row["alert_type"], row["level"]) for row in cursor.fetchall()}

def resolve_alerts(conn, device_id, alerts_to_resolve):
    """Marks a set of alerts as resolved in the DB."""
    cursor = conn.cursor()
    for alert_type, level in alerts_to_resolve:
        cursor.execute("""
            UPDATE alerts SET resolved = 1
            WHERE container_id = ? AND alert_type = ? AND level = ? AND resolved = 0
        """, (device_id, alert_type, level))
    conn.commit()

def add_to_outbox(conn, kind, target_path, payload):
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO outbox (kind, target_path, payload, created_at)
        VALUES (?, ?, ?, ?)
    """, (kind, target_path, json.dumps(payload), datetime.utcnow().isoformat()))
    conn.commit()

# ---------------------------
# MQTT Event Handlers
# ---------------------------
def on_connect(client, userdata, flags, rc):
    print("MQTT connected with result code", rc)
    client.subscribe(TOPIC)


def on_message(client, userdata, msg):
    conn = None
    try:
        topic_parts = msg.topic.split("/")
        device_id = topic_parts[1]
        payload = json.loads(msg.payload.decode())

        conn = get_db()

        # Step 1: Standard processing (status update, telemetry logging)
        init_container_if_missing(conn, device_id, payload.get("selected_food_type", "unknown"))
        update_container_status(conn, device_id)
        insert_telemetry(conn, device_id, payload)
        add_to_outbox(conn, "telemetry", f"containers/{device_id}/telemetry", payload)

        # Step 2: Stateful Alert Evaluation
        thresholds = get_merged_thresholds(conn, device_id)
        
        # Get current state from DB and new state from telemetry
        active_db_alerts = get_active_alerts(conn, device_id)
        evaluated_alerts_list = evaluate_telemetry(payload, thresholds)
        evaluated_alerts_set = {(a['type'], a['level']) for a in evaluated_alerts_list}

        # Compare states to find what's new and what's cleared
        alerts_to_create = evaluated_alerts_set - active_db_alerts
        alerts_to_resolve = active_db_alerts - evaluated_alerts_set

        # Step 3: Resolve cleared alerts
        if alerts_to_resolve:
            resolve_alerts(conn, device_id, alerts_to_resolve)
            print(f"[{device_id}] Resolved alerts: {alerts_to_resolve}")

        # Step 4: Create new alerts
        if alerts_to_create:
            for alert_dict in evaluated_alerts_list:
                if (alert_dict['type'], alert_dict['level']) in alerts_to_create:
                    alert_id, alert_ts = create_alert(conn, device_id, alert_dict)
                    alert_payload = {**alert_dict, "id": alert_id, "device_id": device_id, "timestamp": alert_ts}
                    add_to_outbox(conn, "alert", f"containers/{device_id}/alerts", alert_payload)
                    print(f"[{device_id}] New Alert: {alert_dict['message']}")

        print(f"[{device_id}] Telemetry processed.")

    except Exception as e:
        print("Error handling message:", e)
    finally:
        if conn:
            conn.close()


# ---------------------------
# Main loop with reconnect
# ---------------------------
def start_mqtt_listener():
    while True:
        try:
            client = mqtt.Client()
            if MQTT_USERNAME:
                client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

            client.on_connect = on_connect
            client.on_message = on_message

            client.connect(MQTT_HOST, MQTT_PORT, 60)
            client.loop_forever()

        except Exception as e:
            print("MQTT connection error:", e)
            print(f"Reconnecting in {RECONNECT_DELAY} seconds...")
            time.sleep(RECONNECT_DELAY)


if __name__ == "__main__":
    print("Starting MQTT Listener...")
    start_mqtt_listener()
