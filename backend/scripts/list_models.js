const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
  const key = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
  const firstKey = key.split(',')[0].trim();
  const genAI = new GoogleGenerativeAI(firstKey);

  try {
    console.log("Fetching available models for your API key...");
    // We use the underlying fetch to see all models
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${firstKey}`);
    const data = await response.json();
    
    if (data.models) {
      console.log("\n✅ Available Models:");
      data.models.forEach(m => {
        console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
      });
    } else {
      console.log("❌ No models found or error in response:", data);
    }
  } catch (err) {
    console.error("❌ Error listing models:", err.message);
  }
}

listModels();
