/* by NALAN
  esp32_mqtt_telemetry.ino
  - DHT22 (temperature, humidity)
  - MQ-4 using MQUnifiedsensor (calibration + readSensor)
  - GPS (TinyGPS++)
  - WiFi + MQTT (PubSubClient)
  - Publishes telemetry JSON to: containers/<device_id>/telemetry
  - Publishes retained status to: containers/<device_id>/status (online/offline) using LWT
  - LCD (16x2 I2C) + Status LEDs (Red/Green/Yellow)
*/

#include "secrets.h"  // Include the separate credentials file

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <MQUnifiedsensor.h>
#include <time.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

#define LED_RED    25
#define LED_GREEN  26
#define LED_YELLOW 27
unsigned long yellowBlinkTime = 0;
bool yellowBlinkActive = false;

#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

TinyGPSPlus gps;
HardwareSerial SerialGPS(1);
const uint32_t GPS_BAUD = 9600;
const int GPS_RX_PIN = 16;
const int GPS_TX_PIN = 17;

#define MQ_BOARD    ("ESP-32")
#define MQ_PIN      (34)
#define MQ_TYPE     ("MQ-4")
#define MQ_VOLT_RES (3.3)
#define MQ_ADC_BITS (12)
#define RATIO_CLEAN_AIR (4.4)

MQUnifiedsensor MQ4(MQ_BOARD, MQ_VOLT_RES, MQ_ADC_BITS, MQ_PIN, MQ_TYPE);

const int MQ_SMOOTH_N = 5;
float mq4_window[MQ_SMOOTH_N];
int mq4_idx = 0;
bool mq4_filled = false;

WiFiClient espClient;
PubSubClient mqttClient(espClient);
const unsigned long TELEMETRY_INTERVAL = 10000; 
unsigned long lastTelemetry = 0;

// ---------- LCD + LED Helper Functions ----------
void lcdShowMessage(String line1, String line2, int msDelay=0) {
  lcd.clear();
  lcd.setCursor(0,0); lcd.print(line1);
  lcd.setCursor(0,1); lcd.print(line2);
  if(msDelay > 0) delay(msDelay);
}

void lcdShowTelemetry(float t, float h, float ppm, int sats) {
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("T:"); lcd.print(t,1); lcd.print("C ");
  lcd.print("H:"); lcd.print(h,0); lcd.print("%");
  lcd.setCursor(0,1);
  lcd.print("CH4:"); lcd.print(ppm,0); lcd.print("ppm ");
  lcd.print("Sat:"); lcd.print(sats);
}

void setLedStatus(bool wifiOk, bool mqttOk, bool sensorOk) {
  digitalWrite(LED_GREEN, (wifiOk && mqttOk) ? HIGH : LOW);
  digitalWrite(LED_RED, (!wifiOk || !mqttOk || !sensorOk) ? HIGH : LOW);
}

void blinkYellow() {
  digitalWrite(LED_YELLOW, HIGH);
  yellowBlinkTime = millis();
  yellowBlinkActive = true;
}

String getIsoTimestamp() {
  time_t now;
  time(&now);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  lcdShowMessage("Connecting to", "WiFi..");
  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED && attempt < 40) {
    delay(500);
    Serial.print(".");
    attempt++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected, IP: ");
    Serial.println(WiFi.localIP());
    lcdShowMessage("WiFi Connected", WiFi.localIP().toString(), 3000);
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    delay(500);
  } else {
    Serial.println("WiFi connect failed (will keep trying).");
    lcdShowMessage("WiFi Failed", "Retrying...", 3000);
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {}

void mqttConnectAndSetupLWT() {
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  String clientId = String("esp32-") + DEVICE_ID;
  String willTopic = String("containers/") + DEVICE_ID + "/status";
  const char* willPayload = "offline";
  bool willRetain = true;

  int tries = 0;
  while (!mqttClient.connected()) {
    Serial.print("LWT - Connecting to MQTT...");
    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD, willTopic.c_str(), 1, willRetain, willPayload)) {
      Serial.println("connected to MQTT");
      lcdShowMessage("MQTT Connected", "Broker Online", 3000);
      mqttClient.publish(willTopic.c_str(), "online", true);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" try again in 2s");
      lcdShowMessage("MQTT Failed", "Retrying... "+ String(tries) , 0);
      delay(2000);
      tries++;
      if (tries > 10) break;
    }
  }
}

void publishTelemetry(float temperature_c, float humidity_pct, float mq4_ppm, double lat, double lon, bool fix, int sats) {
  String topic = String("containers/") + DEVICE_ID + "/telemetry";
  String payload = "{";

  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"timestamp\":\"" + getIsoTimestamp() + "\",";
  payload += "\"temperature_c\":" + String(temperature_c, 2) + ",";
  payload += "\"humidity_pct\":" + String(humidity_pct, 2) + ",";
  payload += "\"mq4_ppm\":" + String(mq4_ppm, 2) + ",";
  payload += "\"gps\":{";
  payload += "\"lat\":" + String(fix ? lat : 0.0, 6) + ",";
  payload += "\"lon\":" + String(fix ? lon : 0.0, 6) + ",";
  payload += "\"fix\":" + String(fix ? "true" : "false") + ",";
  payload += "\"satellites\":" + String(sats);
  payload += "}}";

  if (mqttClient.connected()) {
    bool ok = mqttClient.publish(topic.c_str(), payload.c_str());
    if (ok) {
      Serial.print("Published telemetry to ");
      Serial.println(topic);
      lcdShowTelemetry(temperature_c, humidity_pct, mq4_ppm, sats);
      blinkYellow();
    } else {
      Serial.println("Failed to publish telemetry");
      lcdShowMessage("Publish Failed", "Retry...", 2000);
    }
  } else {
    Serial.println("MQTT not connected - cannot publish telemetry");
    lcdShowMessage("MQTT Lost", "Reconnecting...", 2000);
  }
}

// ---------- MQ4 Calibration Function ----------
void calibrateMQ4() {
  MQ4.setRegressionMethod(1);
  MQ4.setA(1012.7);
  MQ4.setB(-2.786);
  MQ4.init();

  bool calibrated = false;
  while (!calibrated) {
    lcdShowMessage("Calibrating MQ4", "Clean Air.. 1min", 0);
    Serial.print("Starting MQ4 calibration... [1min]");

    float calcR0 = 0;
    delay(60000); // allow warm-up
    for (int i = 1; i <= 10; i++) {
      MQ4.update();
      calcR0 += MQ4.calibrate(RATIO_CLEAN_AIR);
      Serial.print(".");
      delay(500);
    }
    Serial.println(" done.");

    calcR0 = calcR0 / 10.0;
    MQ4.setR0(calcR0);

    if (isinf(calcR0) || calcR0 <= 0) {                                           // R0 is always above 100ohm !
      Serial.println("MQ4 calibration invalid (R0 error). Retrying...");
      lcdShowMessage("MQ4 Error", "Retry Calib...", 2000);
      continue; // retry calibration
    }

    MQ4.update();
    float ppmTest = MQ4.readSensor();

    Serial.print("PPM initial : ");
    Serial.println(ppmTest);

    if (isnan(ppmTest) || isinf(ppmTest) || ppmTest < 0 || ppmTest > 20) {         // CHECK WHEHTER NECESSARY
      Serial.println("MQ4 initial ppm out of range. Recalibrating...");
      lcdShowMessage("MQ4 PPM Error", "Retrying...", 2000);
    } else {
      calibrated = true;
      Serial.println("MQ4 calibration successful.");
      lcdShowMessage("MQ4 Calibrated", String("R0=") + String(calcR0,2), 3000);
    }
  }
  MQ4.serialDebug(true);
}

// ---------- Setup ----------
void setup() {
  Serial.begin(115200);
  Serial.println("\nESP32 Telemetry with DHT22 + MQ4 + GPS + MQTT");

  lcd.init();
  lcd.backlight();
  lcdShowMessage("ESP32 Telemetry", "Booting...", 3000);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);

  dht.begin();
  lcdShowMessage("Sensor Init", "DHT22 Ready", 3000);

  SerialGPS.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("GPS serial started");
  lcdShowMessage("GPS Serial", "Started", 3000);

  calibrateMQ4();

  for (int i=0;i<MQ_SMOOTH_N;i++) mq4_window[i] = 0.0;

  connectWiFi();
}

// ---------- Loop ----------
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, attempting reconnect...");
    lcdShowMessage("WiFi Lost", "Reconnecting...", 0);
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    mqttConnectAndSetupLWT();
  }
  mqttClient.loop();

  while (SerialGPS.available() > 0) {
    gps.encode(SerialGPS.read());
  }

  unsigned long now = millis();
  if (now - lastTelemetry >= TELEMETRY_INTERVAL) {
    lastTelemetry = now;

    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("DHT read failed, trying again...");
      temperature = dht.readTemperature();
      humidity = dht.readHumidity();
    }

    MQ4.update();
    float mq4_ppm_raw = MQ4.readSensor(false, 0);

    mq4_window[mq4_idx] = mq4_ppm_raw;
    mq4_idx = (mq4_idx + 1) % MQ_SMOOTH_N;
    if (mq4_idx == 0) mq4_filled = true;
    int count = mq4_filled ? MQ_SMOOTH_N : mq4_idx;
    float sum = 0;
    for (int i=0;i<count;i++) sum += mq4_window[i];
    float mq4_ppm = (count>0)? (sum / count) : mq4_ppm_raw;

    bool fix = gps.location.isValid();
    double lat = fix ? gps.location.lat() : 0.0;
    double lon = fix ? gps.location.lng() : 0.0;
    int sats = gps.satellites.value();

    Serial.print("Temp: "); Serial.print(temperature,2);
    Serial.print(" C, Hum: "); Serial.print(humidity,2);
    Serial.print(" %, MQ4: "); Serial.print(mq4_ppm,2);
    Serial.print(" ppm, GPS fix: "); Serial.print(fix ? "yes":"no");
    Serial.print(", sats: "); Serial.println(sats);

    publishTelemetry(temperature, humidity, mq4_ppm, lat, lon, fix, sats);

    bool sensorOk = true;
    if (isnan(temperature) || isnan(humidity)) sensorOk = false;
    if (isnan(mq4_ppm) || isinf(mq4_ppm) || mq4_ppm <= 0) sensorOk = false;
    if (!gps.location.isValid() && gps.satellites.value() == 0) sensorOk = false;

    setLedStatus(WiFi.status() == WL_CONNECTED, mqttClient.connected(), sensorOk);
  }

  if (yellowBlinkActive && millis() - yellowBlinkTime > 1000) {
    digitalWrite(LED_YELLOW, LOW);
    yellowBlinkActive = false;
  }

  delay(10);
}
