const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
console.log('Checking path:', envPath);
console.log('File exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('File size:', content.length, 'characters');
    console.log('First 50 chars:', JSON.stringify(content.substring(0, 50)));
    
    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.error('Dotenv error:', result.error);
    } else {
        console.log('Dotenv parsed successfully');
        console.log('MONGO_URI found in process.env:', !!process.env.MONGO_URI);
        console.log('MONGO_URI value length:', process.env.MONGO_URI ? process.env.MONGO_URI.length : 0);
    }
} else {
    console.log('Directory listing for', __dirname);
    console.log(fs.readdirSync(__dirname));
}
