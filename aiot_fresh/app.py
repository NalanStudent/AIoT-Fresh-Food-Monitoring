from flask import Flask, render_template, request, redirect, session, url_for, jsonify
from auth import verify_login, require_auth
from functools import wraps
import sqlite3
import os
import json
from datetime import datetime, timezone
import paho.mqtt.publish as publish

app = Flask(__name__)
app.secret_key = os.environ.get('PORTAL_SECRET', 'change_me')

# Use a local path for development to avoid permission issues
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aiot.db")
MQTT_HOST = "localhost"

# ---------------------------
# DB Helpers
# ---------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def add_to_outbox(conn, kind, target_path, payload):
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO outbox (kind, target_path, payload, created_at)
        VALUES (?, ?, ?, ?)
    """, (kind, target_path, json.dumps(payload), datetime.utcnow().isoformat()))
    conn.commit()

# ---------------------------
# Authentication decorator for APIs
# ---------------------------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("username"):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

# ---------------------------
# Login / Logout
# ---------------------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if verify_login(username, password):
            session['logged_in'] = True
            session['username'] = username
            return redirect(url_for('dashboard'))
        return render_template('login.html', error="Invalid username or password")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ---------------------------
# Dashboard (HTML)
# ---------------------------
@app.route('/')
@require_auth
def dashboard():
    return render_template('dashboard.html')

# ---------------------------
# /api/devices
# ---------------------------
@app.route("/api/devices", methods=["GET"])
@login_required
def get_devices():
    if not os.path.exists(DB_PATH):
        return jsonify({"error": "DB not found"}), 500

    devices = []
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM containers")
        rows = cursor.fetchall()

        for row in rows:
            is_online = False
            if row["last_seen"]:
                try:
                    last_seen_dt = datetime.fromisoformat(row["last_seen"])
                    if (datetime.utcnow() - last_seen_dt).total_seconds() < 30:
                        is_online = True
                except (ValueError, TypeError):
                    is_online = False

            device = {
                "device_id": row["device_id"],
                "selected_food_type": row["selected_food_type"],
                "last_seen": row["last_seen"],
                "threshold_overrides": json.loads(row["threshold_overrides"]) if row["threshold_overrides"] else {},
                "status": "online" if is_online else "offline",
                "last_telemetry": {}
            }

            cursor.execute(
                "SELECT * FROM telemetry WHERE device_id=? ORDER BY timestamp DESC LIMIT 1",
                (row["device_id"],)
            )
            telemetry_row = cursor.fetchone()
            if telemetry_row:
                device["last_telemetry"] = {
                    "temperature_c": telemetry_row["temperature_c"],
                    "humidity_pct": telemetry_row["humidity_pct"],
                    "mq4_ppm": telemetry_row["mq4_ppm"],
                    "gps": {
                        "lat": telemetry_row["lat"],
                        "lon": telemetry_row["lon"],
                        "fix": telemetry_row["fix"],
                        "satellites": telemetry_row["satellites"]
                    }
                }

            devices.append(device)

        conn.close()
        return jsonify({"devices": devices})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------
# /api/devices/<id>
# ---------------------------
@app.route("/api/devices/<device_id>", methods=["GET"])
@login_required
def get_device_detail(device_id):
    if not os.path.exists(DB_PATH):
        return jsonify({"error": "DB not found"}), 500

    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM containers WHERE device_id=?", (device_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({"error": "Device not found"}), 404

        is_online = False
        if row["last_seen"]:
            try:
                last_seen_dt = datetime.fromisoformat(row["last_seen"])
                if (datetime.utcnow() - last_seen_dt).total_seconds() < 30:
                    is_online = True
            except (ValueError, TypeError):
                is_online = False

        container = {
            "device_id": row["device_id"],
            "selected_food_type": row["selected_food_type"],
            "last_seen": row["last_seen"],
            "threshold_overrides": json.loads(row["threshold_overrides"]) if row["threshold_overrides"] else {},
            "status": "online" if is_online else "offline",
            "last_telemetry": {}
        }

        cursor.execute(
            "SELECT * FROM telemetry WHERE device_id=? ORDER BY timestamp DESC LIMIT 1",
            (device_id,)
        )
        telemetry_row = cursor.fetchone()
        if telemetry_row:
            container["last_telemetry"] = {
                "temperature_c": telemetry_row["temperature_c"],
                "humidity_pct": telemetry_row["humidity_pct"],
                "mq4_ppm": telemetry_row["mq4_ppm"],
                "gps": {
                    "lat": telemetry_row["lat"],
                    "lon": telemetry_row["lon"],
                    "fix": telemetry_row["fix"],
                    "satellites": telemetry_row["satellites"]
                }
            }
        
        # Simplified threshold logic: only use the overrides
        container["thresholds"] = container["threshold_overrides"]

        conn.close()
        return jsonify({"device": container})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------
# POST /api/devices/<id>/thresholds
# ---------------------------
@app.route("/api/devices/<device_id>/thresholds", methods=["POST"])
@login_required
def update_thresholds(device_id):
    if not os.path.exists(DB_PATH):
        return jsonify({"error": "DB not found"}), 500

    conn = None
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Missing JSON body"}), 400

        new_overrides = data.get("threshold_overrides")
        if not isinstance(new_overrides, dict):
            return jsonify({"error": "'threshold_overrides' must be a JSON object"}), 400
        
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM containers WHERE device_id=?", (device_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Device not found"}), 404

        new_food_type = data.get("selected_food_type", row["selected_food_type"]) # Keep old if not provided
        now_iso = datetime.utcnow().isoformat()
        
        # 1. Update local DB with food_type and thresholds
        cursor.execute(
            "UPDATE containers SET threshold_overrides=?, selected_food_type=?, last_modified=?, source='pi' WHERE device_id=?",
            (json.dumps(new_overrides), new_food_type, now_iso, device_id)
        )
        conn.commit()

        # 2. Construct full config payload
        config_payload = {
            "device_id": device_id,
            "selected_food_type": new_food_type,
            "threshold_overrides": new_overrides,
            "last_modified": now_iso,
            "source": "pi"
        }

        # 3. Publish to retained MQTT topic
        topic = f"containers/{device_id}/config"
        publish.single(topic, payload=json.dumps(config_payload), hostname=MQTT_HOST, retain=True)

        # 4. Queue for cloud sync
        add_to_outbox(conn, "config", f"containers/{device_id}", config_payload)
        
        conn.close()

        return jsonify({
            "status": "success",
            "device_id": device_id,
            "selected_food_type": new_food_type,
            "overrides": new_overrides
        })

    except Exception as e:
        if conn:
            conn.close()
        return jsonify({"error": str(e)}), 500

def create_alert(conn, device_id, alert_info):
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO alerts (container_id, alert_type, level, message, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, (device_id, alert_info["type"], alert_info["level"], alert_info["message"], datetime.utcnow().isoformat()))
    conn.commit()
    return cursor.lastrowid

# ---------------------------
# /api/devices/<id>/alerts
# ---------------------------
@app.route("/api/devices/<device_id>/alerts", methods=["GET"])
@login_required
def get_device_alerts(device_id):
    if not os.path.exists(DB_PATH):
        return jsonify({"error": "DB not found"}), 500
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM alerts WHERE container_id=? ORDER BY timestamp DESC LIMIT 50", (device_id,))
        alerts = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({"alerts": alerts})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------
# DELETE /api/devices/<id>/alerts
# ---------------------------
@app.route("/api/devices/<device_id>/alerts", methods=["DELETE"])
@login_required
def delete_device_alerts(device_id):
    if not os.path.exists(DB_PATH):
        return jsonify({"error": "DB not found"}), 500
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM alerts WHERE container_id=?", (device_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": f"Alerts for device {device_id} have been cleared."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------
# POST /api/devices/<id>/test-alert
# ---------------------------
@app.route("/api/devices/<device_id>/test-alert", methods=["POST"])
@login_required
def post_test_alert(device_id):
    if not os.path.exists(DB_PATH):
        return jsonify({"error": "DB not found"}), 500

    conn = None
    try:
        conn = get_db()
        
        # 1. Create the alert in the local DB
        alert_info = {"type": "test", "level": "info", "message": "This is a test alert triggered from the portal."}
        alert_id = create_alert(conn, device_id, alert_info)

        # 2. Queue the alert for cloud sync
        alert_payload = {**alert_info, "id": alert_id, "device_id": device_id, "timestamp": datetime.utcnow().isoformat()}
        add_to_outbox(conn, "alert", f"testalerts/{device_id}/alerts", alert_payload)
        
        conn.close()
        return jsonify({"status": "success", "message": "Test alert created and queued for sync."})
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({"error": str(e)}), 500

# ---------------------------
# GET /api/sync/status
# ---------------------------
@app.route("/api/sync/status", methods=["GET"])
@login_required
def get_sync_status():
    if not os.path.exists(DB_PATH):
        return jsonify({"pending_items": -1, "error": "DB not found"}), 500
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM outbox")
        count = cursor.fetchone()[0]
        conn.close()
        return jsonify({"pending_items": count})
    except Exception as e:
        return jsonify({"pending_items": -1, "error": str(e)}), 500


# ---------------------------
# Run Flask
# ---------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
