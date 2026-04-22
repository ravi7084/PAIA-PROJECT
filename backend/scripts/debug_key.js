require('dotenv').config();

const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;

if (!rawKeys) {
  console.log("❌ ERROR: No API Key found in .env file!");
} else {
  const keys = rawKeys.split(',').map(k => k.trim());
  console.log(`✅ Found ${keys.length} key(s) in .env`);
  keys.forEach((k, i) => {
    console.log(`🔑 Key #${i+1} starts with: ${k.substring(0, 8)}...`);
  });
}
