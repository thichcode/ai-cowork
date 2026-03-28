const ExcelJS = require('exceljs');

async function readExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const data = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const rowValues = row.values.slice(1);
      data.push(rowValues.map((value) => (value ? value.toString() : '')));
    });
  });
  return data;
}

module.exports = {
  readExcel,
};