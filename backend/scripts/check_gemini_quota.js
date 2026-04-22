const gemini = require('../services/gemini.service');
require('dotenv').config();

async function checkQuota() {
  console.log("🔍 Checking Gemini API Status...");
  try {
    // Very small prompt to save tokens
    const result = await gemini.analyzeAndDecide({
      target: "test.com",
      completedScans: [{ tool: 'ping', status: 'success', data: 'up' }],
      usedTools: ['ping']
    });
    
    if (result) {
      console.log("✅ API is WORKING! Results received successfully.");
      console.log("AI Decision:", result.nextAction);
    }
  } catch (err) {
    if (err.message.includes('429') || err.message.includes('quota')) {
      console.log("❌ API is still RATE LIMITED (429). Please wait another 60 seconds.");
    } else {
      console.log("❌ API Error:", err.message);
    }
  }
}

checkQuota();
