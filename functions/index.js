const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldPath } = require("firebase-admin/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { defineString } = require('firebase-functions/params');

// Initialize Firebase Admin SDK
initializeApp();


// --- Gemini AI Assistant Function ---

// Define the GEMINI_API_KEY as a secret parameter
const geminiApiKey = defineString('GEMINI_API_KEY');

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(geminiApiKey.value());
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

exports.askGemini = onCall(async (request) => {
  const { prompt, containerId } = request.data;
  if (!prompt) {
    throw new HttpsError('invalid-argument', 'The function must be called with a "prompt".');
  }

  const userPrompt = prompt.toLowerCase();
  const db = getFirestore();
  const now = new Date();
  
  // Helper to format timestamp like the Pi (Naive ISO: YYYY-MM-DDTHH:MM:SS.ssssss)
  // We'll just use the first 19 chars (YYYY-MM-DDTHH:MM:SS) for robust prefix matching if needed,
  // but for range queries, standard ISO without 'Z' is best.
  const formatPiTS = (date) => date.toISOString().replace('Z', '');

  // Keyword Detection
  const isForecast = userPrompt.includes('forecast') || userPrompt.includes('predict') || userPrompt.includes('trend');
  const isAlertQuery = userPrompt.includes('alert') || userPrompt.includes('summary') || userPrompt.includes('report');
  const isRCA = userPrompt.includes('why') || userPrompt.includes('cause');
  const isLogistics = userPrompt.includes('route') || userPrompt.includes('reroute') || userPrompt.includes('destination') || userPrompt.includes('dispose');

  console.log(`[askGemini] Prompt: "${prompt}", Container: ${containerId || 'ALL'}`);
  console.log(`[askGemini] Intent - Forecast: ${isForecast}, Alert: ${isAlertQuery}, RCA: ${isRCA}, Logistics: ${isLogistics}`);

  let context = `You are an expert AI assistant for a supply chain fresh food monitoring system called "AIoT Fresh Monitor".
Your role is to answer questions about the status of shipping containers based on the real-time and historical data provided.
Be concise, clear, and professional. 
Current date/time (UTC): ${now.toUTCString()}`;

  try {
    let dataSummary = '';

    if (containerId) {
      // --- Specific Container Focus ---
      const docRef = db.collection('containers').doc(containerId);
      const docSnap = await docRef.get();
      
      if (!docSnap.exists) {
        dataSummary = `No data found for Container ID: ${containerId}`;
      } else {
        const containerData = docSnap.data();
        dataSummary = `[SPECIFIC FOCUS] Data for Container ID: ${containerId}\n`;
        dataSummary += `- Cargo: ${containerData.selected_food_type || 'N/A'}\n`;
        dataSummary += `- Status: ${containerData.status?.state || 'N/A'}\n`;
        dataSummary += `- Latest Telemetry: Temp: ${containerData.latest_telemetry?.temperature_c ?? '--'}°C, Humidity: ${containerData.latest_telemetry?.humidity_pct ?? '--'}%, Gas: ${containerData.latest_telemetry?.mq4_ppm ?? '--'} ppm\n`;
        dataSummary += `- Location: Lat: ${containerData.latest_telemetry?.gps?.lat ?? 'N/A'}, Lon: ${containerData.latest_telemetry?.gps?.lon ?? 'N/A'}\n`;
        dataSummary += `- Thresholds: ${JSON.stringify(containerData.threshold_overrides)}\n`;

        // Supplemental Data Fetching
        if (isForecast || isRCA || userPrompt.includes('history')) {
          const fiveHoursAgoTS = formatPiTS(new Date(now.getTime() - 5 * 60 * 60 * 1000));
          console.log(`[askGemini] Fetching telemetry since: ${fiveHoursAgoTS}`);
          
          // Querying by Document ID (which is the timestamp)
          const telemetrySnap = await docRef.collection('telemetry')
            .where(FieldPath.documentId(), '>=', fiveHoursAgoTS)
            .orderBy(FieldPath.documentId(), 'asc')
            .get();
          
          if (!telemetrySnap.empty) {
            console.log(`[askGemini] Found ${telemetrySnap.size} telemetry records.`);
            dataSummary += `\n[HISTORICAL TELEMETRY - Last 5 Hours]:\n`;
            telemetrySnap.forEach(t => {
              const d = t.data();
              dataSummary += `- ${t.id}: ${d.temperature_c}°C, ${d.humidity_pct}%, Gas: ${d.mq4_ppm}ppm\n`;
            });
          } else {
            console.log(`[askGemini] No historical telemetry found in range.`);
          }
        }

        if (isAlertQuery || isRCA) {
          const twentyFourHoursAgoTS = formatPiTS(new Date(now.getTime() - 24 * 60 * 60 * 1000));
          console.log(`[askGemini] Fetching alerts since: ${twentyFourHoursAgoTS}`);

          const alertsSnap = await docRef.collection('alerts')
            .where(FieldPath.documentId(), '>=', twentyFourHoursAgoTS)
            .orderBy(FieldPath.documentId(), 'desc')
            .get();
          
          if (!alertsSnap.empty) {
            console.log(`[askGemini] Found ${alertsSnap.size} alert records.`);
            dataSummary += `\n[RECENT ALERTS - Last 24 Hours]:\n`;
            alertsSnap.forEach(a => {
              const d = a.data();
              dataSummary += `- ${a.id}: ${d.level.toUpperCase()} - ${d.message}\n`;
            });
          } else {
            dataSummary += `\nNo alerts recorded in the last 24 hours.\n`;
          }
        }
      }
    } else {
      // --- Global/All Containers Focus ---
      const snapshot = await db.collection('containers').get();
      if (snapshot.empty) {
        dataSummary = "No containers found in the system.";
      } else {
        dataSummary = "[GLOBAL SUMMARY] Overview of all containers:\n";
        for (const doc of snapshot.docs) {
          const containerData = doc.data();
          dataSummary += `\nContainer: ${doc.id} (${containerData.selected_food_type || 'Unknown Cargo'})\n`;
          dataSummary += `- Status: ${containerData.status?.state || 'N/A'}\n`;
          dataSummary += `- Temp: ${containerData.latest_telemetry?.temperature_c ?? '--'}°C, Gas: ${containerData.latest_telemetry?.mq4_ppm ?? '--'} ppm\n`;
          
          if (isAlertQuery) {
            const recentAlertsSnap = await doc.ref.collection('alerts')
              .orderBy(FieldPath.documentId(), 'desc')
              .limit(3)
              .get();
            if (!recentAlertsSnap.empty) {
               dataSummary += `- Recent Alerts: `;
               const msgs = [];
               recentAlertsSnap.forEach(a => msgs.push(a.data().message));
               dataSummary += msgs.join('; ') + '\n';
            }
          }
        }
      }
    }

    // Logistic Decision System Prompt Add-on
    if (isLogistics) {
      context += `\nSpecial Instruction: The user is asking for logistics advice (rerouting or disposal). 
Use the provided Health Meter (implied by Gas levels and Temp) and current GPS location. 
If the user provides a destination, compare current conditions against the cargo's thresholds to suggest if it will arrive fresh or if intervention is needed.`;
    }

    context += `\n\n[CONTEXT DATA START]\n${dataSummary}\n[CONTEXT DATA END]`;
    
    const fullPrompt = `${context}\n\nUser Question: ${prompt}\n\nAI Answer:`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    
    return { response: text };

  } catch (error) {
    console.error("Error in askGemini context builder:", error);
    throw new HttpsError('internal', 'An error occurred while building context for the AI.');
  }
});


// --- Scheduled Staleness Check Function ---

exports.markStaleDevicesOffline = onSchedule("every 5 minutes", async (event) => {
  const db = getFirestore();
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // Query for devices that are 'online' but haven't been seen in the last 5 minutes
  const staleDevicesQuery = db.collection('containers')
    .where('status.state', '==', 'online')
    .where('last_seen', '<', fiveMinutesAgo.toISOString());

  try {
    const querySnapshot = await staleDevicesQuery.get();

    if (querySnapshot.empty) {
      console.log("No stale devices found.");
      return;
    }

    // Use a bulk writer for efficient updates
    const bulkWriter = db.bulkWriter();
    let staleDeviceCount = 0;

    querySnapshot.forEach(doc => {
      staleDeviceCount++;
      const docRef = db.collection('containers').doc(doc.id);
      bulkWriter.update(docRef, { 
        'status.state': 'offline',
        'status.reason': 'Stale data detected by Cloud Function.',
        'status.last_update': now.toISOString()
      });
    });

    await bulkWriter.close();
    console.log(`Successfully marked ${staleDeviceCount} stale devices as offline.`);

  } catch (error) {
    console.error("Error running markStaleDevicesOffline function:", error);
  }
});

