const mongoose = require('mongoose');
const dns = require('node:dns/promises');

dns.setServers(['1.1.1.1', '8.8.8.8']);

const connectDB = async () => {
  const url = process.env.MONGO_URI;

  try {
    await mongoose.connect(url);
    console.log('database connected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;
