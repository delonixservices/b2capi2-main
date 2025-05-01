let mongoUri;

process.env.DB_CONNECTION_STRING
  mongoUri = process.env.DB_CONNECTION_STRING;

// console.log(mongoUri);
module.exports = {
  mongo_uri: mongoUri
}