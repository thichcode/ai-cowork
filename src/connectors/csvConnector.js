const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function csvExists(filePath) {
  return fs.existsSync(filePath);
}

module.exports = {
  readCsv,
  csvExists,
};