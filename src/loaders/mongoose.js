const mongoose = require('mongoose');
const dbConfig = require('../config/db');

const mongooseLoader = async () => {
    try {
        await mongoose.connect(dbConfig.mongo_uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
            // 🔥 Removed useFindAndModify
        });
        console.log("\x1b[32m%s\x1b[0m", `MongoDB connection established...`);
    } catch (err) {
        console.log("\x1b[31m%s\x1b[0m", `Unable to connect to the MongoDB, Error: ${err.message}`);
        process.exit(1);
    }
};

module.exports = mongooseLoader;
