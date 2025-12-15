const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { defineString } = require('firebase-functions/params');

// Initialize Firebase Admin SDK
initializeApp();

// Define the GEMINI_API_KEY as a secret parameter
const geminiApiKey = defineString('GEMINI_API_KEY');

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(geminiApiKey.value());
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

exports.askGemini = onCall(async (request) => {
  // Basic check to ensure the user is authenticated (if you add auth later)
  // if (!request.auth) {
  //   throw new HttpsError('unauthenticated', 'You must be logged in to use the AI assistant.');
  // }

  const { prompt, containerId } = request.data;
  if (!prompt) {
    throw new HttpsError('invalid-argument', 'The function must be called with a "prompt".');
  }

  let context = `You are an expert AI assistant for a supply chain fresh food monitoring system called "AIoT Fresh Monitor".
Your role is to answer questions about the status of shipping containers based on the real-time and historical data provided.
Be concise and clear in your answers.
Current date: ${new Date().toUTCString()}`;

  try {
    const db = getFirestore();
    let dataSummary = '';

    if (containerId) {
      // Fetch data for a specific container
      const docRef = db.collection('containers').doc(containerId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const containerData = docSnap.data();
        dataSummary = `Data for Container ID: ${containerId}
- Cargo: ${containerData.selected_food_type || 'N/A'}
- Status: ${containerData.status?.state || 'N/A'}
- Last Seen: ${containerData.last_seen ? new Date(containerData.last_seen).toUTCString() : 'N/A'}
- Latest Telemetry:
  - Temperature: ${containerData.latest_telemetry?.temperature_c ?? '--'}°C
  - Humidity: ${containerData.latest_telemetry?.humidity_pct ?? '--'}%
  - Gas Level: ${containerData.latest_telemetry?.mq4_ppm ?? '--'} ppm
- Thresholds: ${JSON.stringify(containerData.threshold_overrides)}`;
      } else {
        dataSummary = `No data found for Container ID: ${containerId}`;
      }
    } else if (prompt.toLowerCase().includes('all containers') || prompt.toLowerCase().includes('summary')) {
       // Fetch data for all containers
       const snapshot = await db.collection('containers').get();
       if (snapshot.empty) {
         dataSummary = "No containers found in the system.";
       } else {
         dataSummary = "Here is a summary of all containers:\n";
         snapshot.forEach(doc => {
            const containerData = doc.data();
             dataSummary += `
- Container ID: ${doc.id}
- Status: ${containerData.status?.state || 'N/A'}
- Cargo: ${containerData.selected_food_type || 'N/A'}
- Temp: ${containerData.latest_telemetry?.temperature_c ?? '--'}°C`;
         });
       }
    }

    context += `\nHere is the data summary to use for your answer:\n${dataSummary}`;
    const fullPrompt = `Context: ${context}\n\nQuestion: ${prompt}\n\nAnswer:`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    
    return { response: text };

  } catch (error) {
    console.error("Error calling Gemini or fetching Firestore data:", error);
    throw new HttpsError('internal', 'An error occurred while processing your request.');
  }
});
