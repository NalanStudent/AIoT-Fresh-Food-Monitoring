# AIoT System for Intelligent Supply Chain Fresh Food Monitoring

This project implements an IoT system for monitoring fresh food in a supply chain using ESP32 sensors, a Raspberry Pi edge gateway, and a cloud backend.

## Project Structure

- `ESP32/`: Contains the Arduino firmware for the sensor nodes.
- `aiot_fresh/`: Contains the Python backend code for the Raspberry Pi, including the Flask web portal and MQTT listener.
- `gemini.md`: The detailed project specification.
- `firestore.rules`: Security rules for the Firebase Firestore database.
- `Gemini_NOTE.txt`: Your personal notes for the project.

## Setup and Deployment

### 1. ESP32 Firmware

1.  Open the `ESP32/` directory.
2.  Create a `secrets.h` file based on the example in the directory, filling in your WiFi and MQTT credentials.
3.  Flash the `telemetry_v3.ino` sketch to your ESP32 device using the Arduino IDE or PlatformIO.

### 2. Raspberry Pi Backend

1.  **Clone this repository to your Raspberry Pi.**
2.  **Install dependencies:**
    ```bash
    sudo apt-get update
    sudo apt-get install -y mosquitto mosquitto-clients python3-pip
    pip3 install -r aiot_fresh/requirements.txt
    ```
3.  **Initialize the database:**
    The application expects the database at `/var/lib/aiot_fresh/aiot.db`. Run the init script, which will create the directory and set permissions.
    ```bash
    sudo python3 aiot_fresh/init_db.py
    ```
    You may need to run this script a second time if the directory needs to be created, to ensure permissions are set correctly on the database file itself.
4.  **Create a user for the web portal:**
    Since the `admin_create_user.py` script was removed, you need to add a user manually. You can use a Python shell:
    ```python
    import sqlite3
    import bcrypt
    DB_PATH = "/var/lib/aiot_fresh/aiot.db"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    username = "admin"
    password = "your_password" # Choose a strong password
    hashed_password = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, hashed_password))
    conn.commit()
    conn.close()
    # You might need to adjust permissions on the database file again after this
    sudo chmod 640 /var/lib/aiot_fresh/aiot.db
    ```

5.  **Run the services:**
    For development, you can run them in separate terminals:
    - **MQTT Listener:** `python3 aiot_fresh/mqtt_listener.py`
    - **Web Portal:** `python3 aiot_fresh/app.py`

    For production, you should run these as `systemd` services.

### 3. Firebase

1.  Create a Firebase project in the Firebase Console.
2.  Enable **Firestore** and **Firebase Cloud Messaging (FCM)**.
3.  Go to **Project Settings -> Service Accounts** and generate a new private key. Save this `serviceAccountKey.json` file securely on your Raspberry Pi. The backend services will need the path to this file.
4.  Go to the **Firestore Database -> Rules** tab and paste the contents of `firestore.rules`.
5.  To enable 7-day data retention (TTL), you need to create a TTL policy on the `telemetry` collection. In the Firestore UI, go to the `telemetry` collection and create a TTL policy on the `received_at` field.

## Next Steps

The backend and ESP32 firmware are now functional. The remaining high-level tasks are:

- **Mobile App:** Build the React Native mobile application as specified in `gemini.md`.
- **Chat Backend:** Implement the Gemini chat backend.
- **Systemd Services:** Create `systemd` unit files for running the `mqtt_listener` and `app` services automatically on the Raspberry Pi.
- **Testing:** Write more comprehensive tests for the backend logic.

This README provides a starting point for setting up and running the project. Refer to `gemini.md` for the complete project specification.
