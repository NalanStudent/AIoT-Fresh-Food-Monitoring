# AI Feature Roadmap for AIoT Fresh Monitor

This document outlines the current, planned, and potential future AI features for the AIoT Fresh Food Monitoring system. Each feature includes implementation details and a test case to help gauge complexity, prioritize development, and guide demonstrations.

---

## Section 1: Current & Implemented Features

### 1. Contextual Q&A Chatbot
- **What it is:** A chat interface where users can ask natural language questions about the system, with the AI's answers being based on real-time data.
- **Status:** **Implemented**
- **Implementation Details:**
  - **Method:** The existing `askGemini` Cloud Function is called from the mobile app. The function checks if a `containerId` is provided and builds a context prompt accordingly.
  - **Data Required:**
    - For specific queries: The single document from the `containers/{id}` collection.
    - For general queries: A lightweight summary of all documents in the `containers` collection.
  - **Estimated Difficulty:** **Implemented**
- **Demonstration / Test Case:**
  - **User Input:** Select `container-001` from the "Focus" dropdown. Type and send: `What is the current temperature?`
  - **Expected AI Output:** "The current temperature for container-001 is 4.5°C."

---

## Section 2: Proposed New AI Features & Enhancements

This section proposes new, high-impact AI features, ranked by estimated difficulty.

### **Difficulty: Easy**

### 2. Alert Summary
- **What it is:** A new capability for the chatbot where a user can ask for a summary of historical alerts.
- **Status:** **Not Yet Implemented**
- **Implementation Details:**
  - **Method:** Modify the `askGemini` Cloud Function to detect keywords like "alert" and "summary". If detected, the function will query the `alerts` subcollection for the relevant container(s), create a summary, and add it to the AI's context.
  - **Data Required:** The `alerts` subcollection within one or all container documents.
  - **Estimated Difficulty:** **Easy**
- **Demonstration / Test Case:**
  - **User Input:** Select "All Containers" from the "Focus" dropdown. Type and send: `Summarize all critical alerts from the last 24 hours.`
  - **Expected AI Output:** "In the last 24 hours, there was 1 critical alert. Container-002 reported a 'Critical temperature: 9.2°C' at 14:32 UTC."

### **Difficulty: Medium**

### 3. Temperature Forecasting
- **What it is:** The ability to ask the AI for a near-term temperature forecast for a specific container.
- **Status:** **Not Yet Implemented**
- **Implementation Details:**
  - **Method:** Enhance `askGemini` to fetch a larger set of recent historical data points from the `telemetry` subcollection. Pass this time-series data to the Gemini model with a prompt asking it to predict the next few values based on the trend.
  - **Data Required:** A series of recent documents from `containers/{id}/telemetry`.
  - **Estimated Difficulty:** **Medium**
- **Demonstration / Test Case:**
  - **User Input:** Select `container-003` from the "Focus" dropdown. Type and send: `What is the temperature forecast for the next hour?`
  - **Expected AI Output:** "Based on the recent trend of a 0.5°C increase per hour, the temperature for container-003 is projected to be approximately 6.2°C within the next hour."

### 4. Root Cause Analysis (RCA) for Alerts
- **What it is:** When an alert occurs, the user can ask the AI, "Why did this happen?" The AI would analyze correlated data to provide a probable cause.
- **Status:** **Not Yet Implemented**
- **Implementation Details:**
  - **Method:** Enhance `askGemini`. When a prompt mentions an alert, the function will fetch the alert data plus telemetry and GPS data from the time period around the alert. This correlated data is passed to the AI with a prompt asking for causal analysis.
  - **Data Required:** `alerts` data, `telemetry` data (especially the `gps` object), and `timestamp` fields.
  - **Estimated Difficulty:** **Medium**
- **Demonstration / Test Case:**
  - **User Input:** Select `container-002` from the "Focus" dropdown. Type and send: `Why was there a temperature alert this afternoon?`
  - **Expected AI Output:** "The temperature alert for container-002 happened at 14:32 UTC. This coincided with a 45-minute stop in a high-temperature zone, suggesting a potential issue with the container's cooling unit during prolonged stops."

### **Difficulty: Hard**

### 5. Intelligent ETA (Estimated Time of Arrival)
- **What it is:** Allows a user to ask, "How long will it take for container-001 to reach its destination?"
- **Status:** **Not Yet Implemented**
- **Implementation Details:**
  - **Method:** Enhance `askGemini` to integrate with a mapping service API (like Google Maps). It would take the container's current GPS coordinates and a destination from the prompt, send them to the API, and format the ETA into a natural language response.
  - **Data Required:** The latest `gps.lat` and `gps.lon` from `latest_telemetry`. Requires an external Google Maps API key.
  - **Estimated Difficulty:** **Hard**
- **Demonstration / Test Case:**
  - **User Input:** Select `container-001` from the "Focus" dropdown. Type and send: `What is the ETA to the port in Houston, TX?`
  - **Expected AI Output:** "Container-001 is currently 250 miles from the port in Houston, TX. Based on current speed and traffic data, the estimated time of arrival is approximately 4 hours and 15 minutes."

### 6. Downloadable Audit Reports
- **What it is:** The ability to ask the AI to generate a structured audit report for a specific container, which can then be downloaded as a text file.
- **Status:** **Not Yet Implemented**
- **Implementation Details:**
  - **Method:** **Backend:** The `askGemini` function would need a mode to generate a detailed, structured (e.g., Markdown) report. **Frontend:** The mobile app would need a "Download Report" button and use the device's native file-saving capabilities.
  - **Data Required:** A large number of documents from the `telemetry` and `alerts` subcollections.
  - **Estimated Difficulty:** **Hard**
- **Demonstration / Test Case:**
  - **User Input:** Select `container-002` from the "Focus" dropdown. Type and send: `Generate an audit report for the last 48 hours.` (A "Download" button appears in the app).
  - **Expected AI Output:** A chat message "The audit report is ready. Click the button to download." The downloaded file would contain a structured summary of events, alerts, and min/max telemetry values.

### 7. Optimal Route Suggestions
- **What it is:** The AI analyzes historical trips to recommend the best route for a given cargo and season.
- **Status:** **Not Yet Implemented**
- **Implementation Details:**
  - **Method:** Requires an offline batch process (e.g., a separate Cloud Function) to analyze all historical telemetry. The results would be stored in a new `analytics` collection that the `askGemini` function could then query for recommendations.
  - **Data Required:** The entire `telemetry` history (especially `gps` data) for all containers.
  - **Estimated Difficulty:** **Hard**
- **Demonstration / Test Case:**
  - **User Input:** Type and send: `What is the best route for shipping avocados to New York in July?`
  - **Expected AI Output:** "Based on 15 previous trips, Route B (via I-80) has a 25% lower incidence of critical temperature alerts for avocados in summer compared to Route A (via I-40). I recommend Route B."

### **Difficulty: Very Hard**

### 8. Spoilage Prediction & Shelf-Life Estimation
- **What it is:** The AI uses a trip's complete data to predict spoilage likelihood or estimate remaining shelf-life.
- **Status:** **Not Yet Implemented**
- **Implementation Details:**
  - **Method:** This would require training a dedicated machine learning model (e.g., using Google's Vertex AI) on a historical dataset that includes the final spoilage outcome. The model would be deployed as an endpoint that the `askGemini` function could call.
  - **Data Required:** A large, labeled historical dataset containing full `telemetry` for many trips plus the final outcome (e.g., `spoiled: true`).
  - **Estimated Difficulty:** **Very Hard**
- **Demonstration / Test Case:**
  - **User Input:** Select `container-001` from the "Focus" dropdown. Type and send: `What is the quality outlook for this shipment?`
  - **Expected AI Output:** "This shipment experienced 3 hours above the recommended humidity level. Based on this, the estimated shelf-life upon arrival has been reduced by approximately 18 hours."