const mongoose = require('mongoose');
const dns = require('node:dns/promises');

dns.setServers(['1.1.1.1', '8.8.8.8']);

const connectDB = async () => {
  const url = process.env.MONGO_URI;
  console.log('--- DEBUG: Mongoose Connect ---');
  console.log('URI Type:', typeof url);
  console.log('URI Length:', url ? url.length : 'N/A');
  
  try {
    await mongoose.connect(url);
    console.log('database connected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;
