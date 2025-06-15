const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/miscalc_db?authSource=admin';
console.log('Testing MongoDB connection...');
console.log('URI:', mongoUri);

mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((error) => {
    console.log('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }); 