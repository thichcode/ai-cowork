const path = require('path');
const fs = require('fs');
const { csvExists } = require('../connectors/csvConnector');
const { checkTableExists } = require('../connectors/dbConnector');
const { excelExists } = require('../connectors/excelConnector');

const VAGUE_WORDS = ['something', 'thing', 'stuff', 'whatever', 'some', 'anything', 'đại loại', 'cái gì đó', 'vài thứ'];
const MIN_REQUEST_LENGTH = 10;

function checkInputSufficiency(request) {
  const checks = [];
  let sufficient = true;

  if (!request || request.trim().length === 0) {
    return { sufficient: false, reason: 'Request is empty', suggestions: ['Vui lòng nhập yêu cầu cụ thể'], level: 'input' };
  }

  if (request.trim().length < MIN_REQUEST_LENGTH) {
    checks.push('Request quá ngắn, thiếu thông tin');
    sufficient = false;
  }

  const words = request.toLowerCase().split(/\s+/);
  const actionVerbs = ['analyze', 'check', 'report', 'monitor', 'backup', 'sync', 'compare', 'summarize', 'phân tích', 'kiểm tra', 'báo cáo'];
  const hasAction = words.some(w => actionVerbs.includes(w));
  if (!hasAction) {
    checks.push('Không xác định được hành động cần thực hiện');
    sufficient = false;
  }

  const nouns = ['backup', 'health', 'status', 'report', 'data', 'service', 'metric', 'database', 'system', 'server', 'log', 'error'];
  const hasNouns = words.some(w => nouns.includes(w));
  if (!hasNouns) {
    checks.push('Không xác định được đối tượng cần xử lý');
    sufficient = false;
  }

  const vagueFound = words.filter(w => VAGUE_WORDS.includes(w));
  if (vagueFound.length > 0) {
    checks.push(`Từ khóa mơ hồ: "${vagueFound.join(', ')}"`);
    sufficient = false;
  }

  return {
    sufficient,
    reason: sufficient ? null : checks.join('; '),
    suggestions: sufficient ? [] : ['Vui lòng mô tả rõ: bạn muốn làm gì? với cái gì?'],
    checks,
    level: 'input',
  };
}

async function checkDataAvailability(request, dataDir) {
  const missing = [];
  const details = {};
  const requestLower = request.toLowerCase();

  const csvFile = path.resolve(dataDir, 'backup-readiness.csv');
  const dbFile = path.resolve(dataDir, 'infra.db');
  const excelFile = path.resolve(dataDir, 'service-metrics.xlsx');

  if (requestLower.includes('backup') || requestLower.includes('report')) {
    const csvOk = csvExists(csvFile);
    details.csv = { path: csvFile, exists: csvOk };
    if (!csvOk) missing.push('CSV file backup-readiness.csv not found');

    const dbOk = fs.existsSync(dbFile);
    details.db = { path: dbFile, exists: dbOk };
    if (!dbOk) {
      missing.push('Database file infra.db not found');
    } else {
      const tableCheck = await checkTableExists(dbFile, 'backups');
      details.db.tableCheck = tableCheck;
      if (!tableCheck.exists) missing.push('Table "backups" not found in infra.db');
    }

    const excelOk = excelExists(excelFile);
    details.excel = { path: excelFile, exists: excelOk };
    if (!excelOk) missing.push('Excel file service-metrics.xlsx not found');
  }

  return {
    available: missing.length === 0,
    missing,
    details,
    level: 'data',
  };
}

function checkImprovementFeasibility(goalHistory) {
  if (!goalHistory || goalHistory.length < 1) {
    return { feasible: true };
  }

  const latest = goalHistory[goalHistory.length - 1];
  if (!latest || latest.isMet) {
    return { feasible: true };
  }

  if (goalHistory.length >= 2) {
    const prev = goalHistory[goalHistory.length - 2].goalScore;
    const curr = goalHistory[goalHistory.length - 1].goalScore;
    const gaps = goalHistory[goalHistory.length - 1].gaps || [];

    if (gaps.length === 0) {
      return { feasible: true };
    }

    const sameGapsAsBefore = goalHistory.length >= 3 &&
      JSON.stringify(goalHistory[goalHistory.length - 1].gaps) ===
      JSON.stringify(goalHistory[goalHistory.length - 2].gaps);

    if (curr <= prev && sameGapsAsBefore) {
      return {
        feasible: false,
        reason: `Score không cải thiện sau ${goalHistory.length} iterations (${prev} → ${curr}), gaps không đổi: ${gaps.join(', ')}`,
        level: 'improvement',
      };
    }

    if (curr <= prev) {
      return {
        feasible: false,
        reason: `Score không tăng (${prev} → ${curr}), còn gaps: ${gaps.join(', ')}`,
        level: 'improvement',
      };
    }

    if (gaps.includes('coverage') && goalHistory.length >= 2) {
      const prevDetails = goalHistory[goalHistory.length - 2].details?.coverage;
      const currDetails = latest.details?.coverage;
      if (prevDetails && currDetails && prevDetails.score === currDetails.score && currDetails.score < 0.5) {
        return {
          feasible: false,
          reason: 'Không thể cải thiện coverage - dữ liệu nguồn không đủ',
          level: 'improvement',
        };
      }
    }
  }

  return { feasible: true };
}

async function validateRequest(request, dataDir) {
  const inputCheck = checkInputSufficiency(request);
  if (!inputCheck.sufficient) {
    return { status: 'INSUFFICIENT_INPUT', ...inputCheck };
  }

  const dataCheck = await checkDataAvailability(request, dataDir);
  if (!dataCheck.available) {
    return { status: 'INSUFFICIENT_DATA', ...dataCheck };
  }

  return { status: 'SUFFICIENT' };
}

module.exports = {
  checkInputSufficiency,
  checkDataAvailability,
  checkImprovementFeasibility,
  validateRequest,
};