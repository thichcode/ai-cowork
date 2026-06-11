const ExcelJS = require('exceljs');
const fs = require('fs');

async function readExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const data = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowValues = row.values.slice(1);
      data.push(rowValues.map((value) => (value ? value.toString() : '')));
    });
  });
  return data;
}

function excelExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

module.exports = {
  readExcel,
  excelExists,
};