const client = require('./client');

module.exports = {
  llm: client,
  generate: client.generate,
};