<!--

System prompt

Use this exact prompt to build the project from scratch. It contains the full system description, architecture, constraints, and the exact step-by-step workflow I want you (the assistant) to follow. Be explicit and actionable — produce code, configs, and tests as asked.


---

I am building “AIoT System for Intelligent Supply Chain Fresh Food Monitoring”. I will give you tasks step-by-step. Before you implement any code or files, explain the step in detail, list any inputs you need from me (if any), and provide a clear test/checklist I can run. I will tell you “Proceed with step X” when I want you to implement that step. Do not proceed until I say so.

Below are the finalized requirements, architecture, data formats, constraints, and the list of deliverables I will ask for. Use these as the authoritative spec.


---

1. High-level system summary (one-sentence)

ESP32-based sensor containers publish telemetry (temperature, humidity, MQ4 ppm, GPS) to a Raspberry Pi edge (MQTT broker + Flask portal) that performs edge checks, stores config locally, forwards validated telemetry and alerts to Firebase (cloud), and exposes data to a React mobile app for real-time monitoring and AI chat (Gemini) — with thresholds editable only from the Pi local portal or Firebase cloud.


---

2. Tech stack & versions (use these unless you explain why not)

ESP32: Arduino core (PlatformIO or Arduino IDE), TinyGPS++ (for Neo-6M), DHT sensor library.

Raspberry Pi: Raspberry Pi OS (64-bit recommended), Python 3.10+, Mosquitto MQTT broker, Flask (backend portal), paho-mqtt, firebase-admin, sqlite3 (local DB).

Cloud: Firebase Firestore (document DB) + FCM for notifications (Pi holds service account). Firestore is for cloud storage and mobile read-only thresholds; Pi is authoritative for threshold edits.

Mobile app: React Native (Expo) or React web (your pick) — app reads telemetry and thresholds from Firestore, but cannot edit thresholds.

AI: Gemini API — chat endpoint resides in a backend (Node/Express or Python) Firebase that builds compact context from Firestore before calling Gemini.

Optional: systemd for services, Cloud Functions for TTL (if you want cloud-side cleanup).



---

3. Key functional rules & constraints (important)

3.1. Threshold editing: Only editable via Pi Portal (local web UI) or Cloud. Mobile app users can view thresholds but must not be allowed to change them. Pi writes threshold_overrides to Firestore only to inform mobile view — Firestore rules must block mobile write to those fields.

3.2. Device discovery: Pi detects “online” ESP devices by observing MQTT telemetry or retained status topics (ESP publishes status and uses LWT for offline); Pi lists all containers seen sending data. This detection is authoritative.

3.3. Local portal: Must have a login page (simple username/password). Portal allows per-device: select food type, edit thresholds (overrides ppm), push config to ESP via retained MQTT containers/<id>/config, show last telemetry, test alert, sync to cloud.

3.4. Local-first sync: Pi stores thresholds in SQLite locally and publishes retained MQTT config and writes override metadata to Firestore with last_modified and source='pi'. Pi is canonical for configuration.

3.5. Conflict resolution: Use last_modified timestamp and source fields. Pi changes win unless cloud has a newer timestamp and source='cloud' (but by policy, mobile will not edit thresholds).

3.6. Telemetry: ESP publishes telemetry to topic containers/<device_id>/telemetry. Telemetry forwarded to Firestore under telemetry/{containerId}/readings/{readingId} for mobile viewing. Telemetry retention: default 7 days (Firestore TTL or Cloud Function cleanup).

3.7. Alerts: Pi evaluates telemetry against the Pi-local thresholds. Pi writes alerts to Firestore alerts/{containerId}/{alertId} and can send FCM. Mobile shows alerts from Firestore.

3.8. Security: Pi stores the Firebase service account JSON only on the Pi (not on devices or frontend). Portal must require login and be bound to LAN (no public exposure by default). Use HTTPS only if you explicitly enable it.

3.9. MQ4 handling: MQ4 ppm value stored and forwarded; conversion of ADC to ppm done in ESP. Optionally, use moving average smoothing and baseline calibration on Pi or ESP (if simple).




---

4. MQTT topics and behaviors (concrete)

- containers/<device_id>/telemetry — JSON telemetry published by ESP, QoS 1 (suggested), retained = false.
- containers/<device_id>/status — retained LWT (ESP publishes online when connected, LWT offline). Pi subscribes to this for quick online/offline.
- containers/<device_id>/config — retained config JSON published by Pi when thresholds or food type change (ESP may subscribe to apply local behavior).
- containers/<device_id>/command — optional topic for test-alert, ota reboot commands, etc.



---

5. Example telemetry & config JSON (use these exact field names)

Telemetry (ESP → Pi):
```json
{  
  "device_id": "container-001",  
  "timestamp": "2025-09-10T07:12:34Z",
  "temperature_c": 4.2,  
  "humidity_pct": 92.3,  
  "mq4_ppm": 120,                          
  "gps": { "lat": 2.984472, "lon": 101.431972, "fix": true, "satellites": 9 }  
}
```
Config (Pi → retained containers/container-001/config):
```json
{  
  "device_id": "container-001",  
  "selected_food_type": "bananas",  
  "threshold_overrides": {  
    "temperature": { "warn": 4.5, "critical": 8.0 },  
    "humidity": { "warn_low": 60.0, "warn_high": 95.0 }  
  },  
  "last_modified": "2025-09-10T07:15:00Z",  
  "source": "pi"  
}
```

---

6. Firestore schema & security rules (high-level)

- **Collections**:
  - food_types/{foodTypeId} — default thresholds and metadata (editable only by admin via cloud or Pi admin sync).
  - containers/{containerId} — metadata: device_id, selected_food_type, last_seen, threshold_overrides (written by Pi). Mobile read-only to thresholds.
  - telemetry/{containerId}/readings/{readingId} — telemetry docs. Include a TTL field if you use Firestore TTL.
  - alerts/{containerId}/alerts/{alertId} — alerts created by Pi.
- **Security rules (summary for Firestore)**:
  - Allow mobile app read to food_types and containers and telemetry and alerts.
  - Deny mobile writes.
  - Allow Pi (service account) full write access. (Implementation detail: Pi uses service account; mobile uses client SDK with rules.)

Include this rule snippet (produce exact Firestore rules later).


---

7. Pi local DB (SQLite) schema (concrete)

- **Tables**:
  - food_types (id TEXT PRIMARY KEY, display_name TEXT, thresholds JSON, notes TEXT)
  - containers (device_id TEXT PRIMARY KEY, selected_food_type TEXT, threshold_overrides JSON, last_seen TEXT)
  - change_log (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id TEXT, user TEXT, action TEXT, before JSON, after JSON, timestamp TEXT, source TEXT)

Pi will persist edits here and publish retained config to MQTT and write overrides to Firestore (metadata only).


---

8. Portal endpoints & UX (API + UI)

- **REST API (Flask skeleton)**:
  - POST /login — portal login (session cookie)
  - GET /api/devices — returns list of detected devices + status + last telemetry (from MQTT cache or DB)
  - GET /api/devices/<id> — device detail and current config (merging food default + overrides)
  - POST /api/devices/<id>/thresholds — update threshold overrides (auth required) => updates SQLite, publishes retained MQTT config, writes to Firestore overrides with metadata, logs change.
  - POST /api/devices/<id>/test-alert — simulate alert
  - GET /api/sync/status — show last cloud sync time & queued items
- **UI pages**:
  - Login, Dashboard (device list), Device detail (telemetry + thresholds + edit form), Admin (food_type editor, backup/restore), Sync & logs.



---

9. Edge behavior & offline-first details

Pi performs threshold checks on incoming telemetry. Pi writes alerts immediately to local DB and attempts to push to Firestore; if offline, it queues the alerts and telemetry, and writes them to local DB until connectivity returns.

When Pi regains internet, it performs a forward of queued telemetry / alerts and writes a sync log entry.



---

10. Minimal step plan to start building (these are the steps I will ask you to implement, one at a time)

When I say Proceed with step N, do exactly that step (explain, then implement). Steps:

10.1. Project setup: Provide exact prereq commands and account setup steps (Firebase project, enable Firestore & FCM, create service account, obtain Gemini API key, install Mosquitto, Python deps). Provide sample requirements.txt.

10.2. ESP32 basic firmware (serial): Sketch that reads DHT22, MQ4 ppm, Neo-6M GPS, prints telemetry JSON to Serial for testing. Include smoothing for MQ4 (moving average).

10.3. MQTT publish on ESP32: Update firmware to publish telemetry to containers/<device_id>/telemetry and publish containers/<device_id>/status (online) and set LWT to offline.

10.4. Pi: Mosquitto + simple MQTT subscriber: Install mosquitto, provide mosquitto.conf basics and mosquitto_sub testing commands; provide a Python mqtt_listener.py that prints incoming telemetry.

10.5. Pi Portal skeleton (Flask): Build Flask app with login, GET /api/devices, GET /api/devices/<id>. Implement an MQTT → websocket binding so UI shows live telemetry. Use SQLite schema above.

10.6. Pi bridge: full logic: pi_bridge.py that subscribes to telemetry, stores reading in SQLite and Firestore, merges thresholds from local food_types + container overrides, evaluates thresholds, writes alerts locally & to Firestore (queued if offline), publishes retained containers/<id>/config when overrides change. Make it runnable as systemd service.

10.7. Firestore security rules & TTL: Provide Firestore rules that prevent mobile edits to thresholds and add TTL or Cloud Function for 7-day retention.

10.8. React Native mobile skeleton: Basic app that reads telemetry and alerts from Firestore and displays dashboard + Map marker (read-only thresholds displayed).

10.9. Chat backend (Gemini): Provide Node/Express or Python endpoint that accepts container_id + user message, fetches latest summary from Firestore or Pi (prefer Firestore), builds concise context, calls Gemini, returns answer. Add rate-limiting.

10.10. Tests, calibration guide, and next steps: Provide testing scripts, MQ4 calibration steps, and instructions for OTA later.

For each step you must provide: code files, clear install/run commands, and tests/checkpoints.

 
---

11. Security & deployment checklist (include in responses)

- Do NOT expose portal to public internet by default. Bind to LAN and use firewall.
- Protect Firebase service account JSON on Pi (chmod 600).
- Use HTTPS if you choose to expose remotely; otherwise require VPN.
- Use strong password for local portal; optionally add two-step admin via SSH key for Pi.
- Use least-privilege Firebase roles for service account where possible.



---

12. What I expect you to produce when I say “Proceed with step N”

- A short explanation of the step (one paragraph).
- A list of required inputs (if any) I must provide (e.g., Firebase project id, service account file, Wi-Fi SSID). If none, say “none”.
- The code files (inline or as file contents) ready to copy/paste with comments. For multi-file outputs, list filenames and show contents.
- Installation instructions and commands (exact shell commands where applicable).
- How to run and test (exact test commands, expected outputs).
- Any safety / security notes specific to the step.
- A short “Next step recommendation”.



---

13. Extra instructions to the assistant

- Keep answers focused and actionable; avoid long theory unless asked.
- When producing code: prefer Python for Pi code and Flask for the portal. Use paho-mqtt + firebase_admin libraries. Use sqlite3 on Pi. For ESP32 produce Arduino C++ code (PlatformIO/Arduino IDE compatible). For mobile, produce React Native (Expo) or plain React web (ask me if you need to choose).
- Provide sample systemd unit files for Pi services.
- When building portal UI, include a simple login (username/password) and session cookie handling — do not implement OAuth unless asked.
- When you produce Firestore rules, include comments explaining each rule.
- When you produce Cloud Functions (if needed), include deployment commands using firebase-tools CLI.



---

14. Useful constants & defaults you may assume unless I override them

- Default MQTT broker: localhost on Pi, port 1883.
- Default telemetry interval on ESP: 15 seconds (configurable).
- Default retention: 7 days (TTL).
- Default DB file on Pi: /var/lib/aiot_fresh/aiot.db (ensure directories and permissions).
- Default web portal port: http://raspberrypi.local:5000 (Flask dev) then production via systemd/gunicorn if requested.



---

15. Final note for the assistant

If the user requests code that interacts with the Gemini API, you may mock the Gemini calls initially but clearly label mocked behavior; later replace with real calls when the user provides API credentials. Always avoid leaking any sensitive keys — request them from the user only when needed and instruct the user how to store them securely (e.g., .env, not in frontend).

NOTE: 

The ESP32 folder hold

---

If you understand all of the above, reply with a brief confirmation and ask: “Which step would you like to start with?”
(When I reply “Proceed with step X”, you must first explain that step in detail and then produce the requested code/files.)

---

SUMMARY OF DEVIATIONS FROM ORIGINAL `gemini.md` SPECIFICATION (As of 2025-12-10):

1.  Simplified Food Type and Threshold Management:
    -   Original Spec: The system was designed to use a `food_types` table/collection to provide default thresholds, which would then be merged with device-specific `threshold_overrides`. The Pi Portal would allow selecting a food type.
    -   Current Implementation: The concept of default thresholds coming from a `food_types` table has been removed for device-specific alerting. Device thresholds are now exclusively managed by the `threshold_overrides` field for each container. Instead of selecting a food type from a predefined list, the `selected_food_type` is now edited as a free-text string directly on the device's configuration modal.

2.  Removed Admin Food Type Editor:
    -   Original Spec: Section 8 mentioned an "Admin" UI page with a `food_type` editor.
    -   Current Implementation: As a direct result of the simplified food type management, the need for an admin page to manage default food types has been eliminated, and this feature has been removed from the project scope.

3.  Additional API Endpoint:
    -   Original Spec: The list of portal REST API endpoints did not explicitly include an endpoint for fetching alerts.
    -   Current Implementation: We added a new API endpoint, `GET /api/devices/<id>/alerts`, to facilitate displaying alerts directly on the Pi Portal dashboard.

4.  Firestore Data Model Refinement:
    -   Original Spec (Section 6): Telemetry and alerts were planned under top-level collections like `telemetry/{containerId}/readings/{readingId}` and `alerts/{containerId}/alerts/{alertId}`.
    -   Current Implementation: Based on further analysis and user preference, the data model has been refined to a nested, entity-centric structure: `containers/{containerId}/telemetry/{timestamp}` and `containers/{containerId}/alerts/{timestamp}`. This provides a cleaner, more scalable, and intuitive grouping of data under the main container document.
    -   Implementation Detail: Document IDs for telemetry and alerts are now ISO 8601 timestamp strings, chosen for human readability, with the acknowledged risk of potential data collision.

5.  Feature Enhancement: Stateful Alerting:
    -   Original Spec (Section 3.7): The spec described basic alert generation but did not detail prevention of duplicate alerts for ongoing conditions.
    -   Current Implementation: Stateful alerting logic has been added to `mqtt_listener.py`. This prevents alert spam by only triggering new alerts for new conditions and automatically resolving alerts when conditions clear, making the alerting system more robust and practical.

6.  Expanded Mobile App Scope (As of 2025-12-12):
    -   Original Spec (Section 10.8): Described a "basic app... skeleton" for read-only monitoring.
    -   Current Implementation: The mobile app's role has been expanded to a full-featured application, including a user login system (Firebase Authentication), a multi-tab interface (Home, AI, Settings), a calculated 'Health Meter' on the dashboard, a comprehensive 'AI Page' (powered by a Cloud Function) for chatbot Q&A, system-wide summaries, and downloadable reports, and real-time push notifications for critical alerts.