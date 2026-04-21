const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { runRemoteExecutable } = require('../utils/commandRunner');
const logger = require('../utils/logger');

async function testRemote() {
  const ip = process.env.REMOTE_SCANNER_IP;
  const user = process.env.REMOTE_SCANNER_USER;
  
  console.log('--- PAIA Remote Scanner Connectivity Test ---');
  console.log(`Target: ${user}@${ip}`);
  console.log('Attempting to run "uname -a" on remote host...');

  try {
    const output = await runRemoteExecutable('uname', ['-a'], { timeout: 10000 });
    console.log('\n✅ SUCCESS!');
    console.log('Remote Output:', output.trim());
    console.log('\nYour Windows machine is successfully talking to your Kali VM!');
  } catch (err) {
    console.log('\n❌ FAILED');
    console.log('Error:', err.message);
    console.log('\nTroubleshooting Tips:');
    console.log('1. Is your Kali VM running?');
    console.log('2. Is SSH enabled on Kali? (sudo systemctl status ssh)');
    console.log('3. Can you ping the Kali IP from Windows?');
    console.log('4. Have you set up SSH keys? (Recommended to avoid password prompts)');
  }
}

testRemote();
