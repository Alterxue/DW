const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const dbName = 'mongoLab';
const client = new MongoClient(uri);

let dbConnection;

module.exports = {
    connectToServer: async function() {
        try {
            await client.connect();
            await client.db(dbName).command({ ping: 1 });
            console.log("Connected successfully to MongoDB.");
            dbConnection = client.db(dbName);
            return dbConnection;
        } catch (err) {
            console.error("MongoDB connection failed", err);
            process.exit();
        }
    },
    getDb: function() {
        return dbConnection;
    }
};
