// Test Script for Dataset Scope Validation
const engine = require('./financial_engine');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Load the benchmark dataset
const csvPath = path.join(__dirname, 'data', 'bcg_x_financial_benchmark.csv');
const csvText = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const result = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
  transformHeader: h => h.trim().replace(/^\uFEFF/, '')
});
const csvData = result.data;

console.log('='.repeat(80));
console.log('📊 DATASET SCOPE VALIDATION TEST');
console.log('='.repeat(80));
console.log(`Dataset loaded: ${csvData.length} records\n`);

// Get dataset metadata
const metadata = engine.extractDatasetMetadata(csvData);
console.log('📋 DATASET METADATA:');
console.log(`  Companies: ${metadata.companies.join(', ')}`);
console.log(`  Years: ${metadata.years.join(', ')}`);
console.log(`  Metrics: ${metadata.metrics.slice(0, 5).join(', ')}... (${metadata.metrics.length} total)`);
console.log();

// Test cases
const testCases = [
  // IN-SCOPE QUESTIONS (Should pass)
  { question: "What is Apple's revenue?", shouldPass: true, reason: "Company name mentioned" },
  { question: "Show me Microsoft profit in 2023", shouldPass: true, reason: "Company + year + metric" },
  { question: "Compare Tesla and BCGX assets", shouldPass: true, reason: "Multiple companies + metric" },
  { question: "What is the total revenue?", shouldPass: true, reason: "Financial metric mentioned" },
  { question: "Show profit margin analysis", shouldPass: true, reason: "Financial term" },
  { question: "Calculate ROE for 2024", shouldPass: true, reason: "Financial ratio + year" },
  { question: "What are the cash flows?", shouldPass: true, reason: "Financial metric" },
  { question: "hi", shouldPass: true, reason: "Greeting (allowed)" },
  { question: ".", shouldPass: true, reason: "Short query (allowed)" },
  
  // OUT-OF-SCOPE QUESTIONS (Should fail)
  { question: "What is the weather today?", shouldPass: false, reason: "Unrelated to dataset" },
  { question: "Who is the CEO of Amazon?", shouldPass: false, reason: "Company not in dataset" },
  { question: "Tell me a joke", shouldPass: false, reason: "Not financial/dataset related" },
  { question: "What happened in 2030?", shouldPass: false, reason: "Year not in dataset (but has financial terms)" },
  { question: "How do I cook pasta?", shouldPass: false, reason: "Completely unrelated" },
  { question: "What is Bitcoin price?", shouldPass: false, reason: "Not in dataset" },
  { question: "Explain quantum physics", shouldPass: false, reason: "Unrelated topic" }
];

console.log('🧪 RUNNING TEST CASES:');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((test, idx) => {
  const scopeCheck = engine.isQuestionInDatasetScope(test.question, csvData);
  const result = scopeCheck.inScope === test.shouldPass;
  
  const status = result ? '✅ PASS' : '❌ FAIL';
  const expected = test.shouldPass ? 'IN-SCOPE' : 'OUT-OF-SCOPE';
  const actual = scopeCheck.inScope ? 'IN-SCOPE' : 'OUT-OF-SCOPE';
  
  console.log(`\nTest ${idx + 1}: ${status}`);
  console.log(`  Question: "${test.question}"`);
  console.log(`  Expected: ${expected} (${test.reason})`);
  console.log(`  Actual: ${actual}`);
  
  if (!result) {
    console.log(`  ⚠️  MISMATCH DETECTED!`);
    console.log(`  Details:`, {
      hasCompany: scopeCheck.hasCompanyMatch,
      hasYear: scopeCheck.hasYearMatch,
      hasMetric: scopeCheck.hasMetricMatch
    });
    failed++;
  } else {
    passed++;
  }
});

console.log('\n' + '='.repeat(80));
console.log('📊 TEST SUMMARY:');
console.log(`  Total Tests: ${testCases.length}`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`  Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
console.log('='.repeat(80));

// Test the actual answer generation with scope validation
console.log('\n🔍 TESTING ACTUAL ANSWER GENERATION:');
console.log('='.repeat(80));

const answerTests = [
  "What is Apple's revenue?",
  "What is the weather today?",
  "Show me profit margins",
  "Tell me about Mars"
];

answerTests.forEach(q => {
  console.log(`\nQuestion: "${q}"`);
  const answer = engine.generateLocalIntelligentAnswer(q, csvData);
  const isOutOfScope = answer === "there is no specific data related to your question\nplease refer the dataset";
  console.log(`Response: ${isOutOfScope ? '🚫 OUT OF SCOPE MESSAGE' : '✅ GENERATED ANSWER'}`);
  console.log(`Preview: ${answer.substring(0, 100)}${answer.length > 100 ? '...' : ''}`);
});

console.log('\n' + '='.repeat(80));
console.log('✅ SCOPE VALIDATION TEST COMPLETED');
console.log('='.repeat(80));
