const express = require('express');
const multer = require('multer');
const Papa = require('papaparse');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const OpenAI = require('openai');
const engine = require('./financial_engine');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let csvData = [];
let headers = [];
let activeDatasetName = 'BCG X Benchmark Suite (AAPL, MSFT, TSLA, BCGX)';

// Helper to load default benchmark CSV file on startup
function loadDefaultDataset() {
  const defaultPath = path.join(__dirname, 'data', 'bcg_x_financial_benchmark.csv');
  if (fs.existsSync(defaultPath)) {
    const csvText = fs.readFileSync(defaultPath, 'utf8').replace(/^\uFEFF/, '');
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().replace(/^\uFEFF/, '')
    });
    if (result.data && result.data.length) {
      csvData = result.data;
      headers = result.meta.fields;
      activeDatasetName = 'BCG X Benchmark Suite (AAPL, MSFT, TSLA, BCGX)';
      console.log(`Default dataset loaded: ${csvData.length} records.`);
    }
  }
}
loadDefaultDataset();

// Upload Offline CSV endpoint (Supports ANY CSV dataset)
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const csvText = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().replace(/^\uFEFF/, '')
    });
    if (result.errors.length && !result.data.length) {
      return res.status(400).json({ error: 'CSV parsing error', details: result.errors });
    }
    csvData = result.data;
    headers = result.meta.fields || (csvData[0] ? Object.keys(csvData[0]) : []);
    activeDatasetName = (req.file.originalname || 'Custom Uploaded Offline CSV').trim().replace(/^\uFEFF/, '');
    const analysis = engine.analyzeDataset(csvData);

    console.log(`Custom offline CSV dataset uploaded: ${activeDatasetName} (${csvData.length} rows)`);

    res.json({
      success: true,
      datasetName: activeDatasetName,
      rows: csvData.length,
      columns: headers,
      preview: csvData.slice(0, 5),
      analysis
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reset to sample preloaded benchmark dataset
app.get('/api/sample-datasets', (req, res) => {
  loadDefaultDataset();
  const analysis = engine.analyzeDataset(csvData);
  res.json({
    success: true,
    datasetName: activeDatasetName,
    rows: csvData.length,
    columns: headers,
    preview: csvData.slice(0, 5),
    analysis
  });
});

// Get active dataset metrics & schema
app.get('/api/metrics', (req, res) => {
  if (!csvData.length) {
    return res.status(400).json({ error: 'No active dataset available' });
  }
  const processed = csvData.map(engine.calculateRowMetrics);
  const analysis = engine.analyzeDataset(csvData);
  const schema = engine.inspectDatasetSchema(csvData);
  res.json({
    success: true,
    datasetName: activeDatasetName,
    totalRecords: csvData.length,
    columns: headers,
    schema,
    rawRecords: csvData,
    calculatedRecords: processed,
    summary: analysis
  });
});

let chatHistory = [];
app.post('/ask', async (req, res) => {
  const { question } = req.body;

  if (!question || !csvData.length) {
    return res.status(400).json({ error: 'No active dataset available or question missing' });
  }

  const trimmedQ = question.trim();
  if (trimmedQ === '.' || trimmedQ === '?' || trimmedQ === '..' || trimmedQ === '...' || trimmedQ.length <= 1 || trimmedQ.toLowerCase() === 'hi' || trimmedQ.toLowerCase() === 'hello') {
    const localAnswer = engine.generateLocalIntelligentAnswer(question, csvData);
    return res.json({
      answer: localAnswer,
      providerUsed: 'BCG X AI Financial Assistant',
      modelUsed: 'wise-ai-guide'
    });
  }

  // Check if question is within dataset scope
  const scopeCheck = engine.isQuestionInDatasetScope(trimmedQ, csvData);
  if (!scopeCheck.inScope) {
    return res.json({
      answer: "there is no specific data related to your question\nplease refer the dataset",
      providerUsed: 'BCG X Dataset Scope Validator',
      modelUsed: 'dataset-scope-check',
      scopeInfo: {
        availableCompanies: scopeCheck.availableCompanies,
        availableYears: scopeCheck.availableYears,
        availableMetrics: scopeCheck.availableMetrics.slice(0, 10) // Show first 10 metrics
      }
    });
  }

  if (!chatHistory.includes(trimmedQ)) {
    chatHistory.push(trimmedQ);
  }

  const systemPrompt = engine.getBCGSystemPrompt(csvData);

  // Get API key from request body (sent from frontend)
  const apiKey = req.body.apiKey;
  const provider = req.body.provider || 'groq';

  // If provider is 'local' or API key is missing, use local engine directly
  if (provider === 'local' || !apiKey || apiKey.trim() === '') {
    const localAnswer = engine.generateLocalIntelligentAnswer(question, csvData);
    return res.json({
      answer: localAnswer,
      providerUsed: 'BCG X Local Intelligent Financial Engine',
      modelUsed: 'local-rule-based-engine'
    });
  }

  try {
    const clientOptions = { 
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: apiKey
    };

    const client = new OpenAI(clientOptions);
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.2,
      max_tokens: 1200,
    });

    const answer = completion.choices[0].message.content;
    res.json({
      answer,
      providerUsed: 'Groq API (Llama-3.3-70b)',
      modelUsed: 'llama-3.3-70b-versatile'
    });
  } catch (error) {
    console.error('LLM API Error:', error);
    const fallbackAnswer = engine.generateLocalIntelligentAnswer(question, csvData);
    res.json({
      answer: fallbackAnswer + `\n\n> Note: External API call failed (${error.message}). Displaying dataset response generated by BCG X Local Intelligent Financial Engine.*`,
      providerUsed: 'Fallback Local Intelligent Engine',
      modelUsed: 'rule-based-fallback'
    });
  }
});

// Get dataset metadata (available companies, years, metrics)
app.get('/api/dataset-info', (req, res) => {
  if (!csvData.length) {
    return res.status(400).json({ error: 'No active dataset available' });
  }
  const metadata = engine.extractDatasetMetadata(csvData);
  res.json({
    success: true,
    datasetName: activeDatasetName,
    totalRecords: csvData.length,
    metadata: {
      companies: metadata.companies,
      years: metadata.years,
      metrics: metadata.metrics,
      allColumns: metadata.columns
    }
  });
});

// Get validation test scenarios list for active dataset
app.get('/api/scenarios', (req, res) => {
  const scenarios = engine.generateDynamicScenarios(csvData, chatHistory);
  res.json({ success: true, count: scenarios.length, scenarios });
});

// Run scenario validation benchmark suite for active dataset
app.post('/api/validate', (req, res) => {
  const reqHistory = req.body && Array.isArray(req.body.chatHistory) && req.body.chatHistory.length ? req.body.chatHistory : chatHistory;
  const scenarios = engine.generateDynamicScenarios(csvData, reqHistory);

  const answerGenerator = (question, datasetRows) => {
    return engine.generateLocalIntelligentAnswer(question, datasetRows);
  };

  try {
    const report = engine.validateScenarios(scenarios, csvData, answerGenerator);
    res.json({
      success: true,
      report
    });
  } catch (e) {
    console.error('Validation error:', e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BCG X AI Financial Analyzer running at http://localhost:${PORT}`);
});