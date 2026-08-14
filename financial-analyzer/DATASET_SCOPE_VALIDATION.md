# Dataset Scope Validation System

## Overview
The BCG X AI Financial Analyzer now includes **intelligent dataset scope validation** that ensures questions are only answered if they relate to data available in the active dataset.

## Features Implemented

### 1. Scope Detection Algorithm
**Location:** `financial_engine.js` (lines 83-240)

The system automatically detects:
- ✅ **Company mentions** - Checks if question references companies in the dataset
- ✅ **Year mentions** - Validates if years mentioned exist in the dataset  
- ✅ **Financial metrics** - Identifies 40+ financial keywords (revenue, profit, assets, ROE, etc.)
- ✅ **Greetings** - Allows friendly greetings (hi, hello) to pass through

### 2. Out-of-Scope Response
When a question is **not related to the dataset**, the system returns:
```
there is no specific data related to your question
please refer the dataset
```

### 3. API Integration
**Location:** `server.js` (lines 128-141)

The `/ask` endpoint now performs scope validation **before** processing questions with LLM or local engine.

### 4. Dataset Metadata API
**New Endpoint:** `GET /api/dataset-info`

Returns available:
- Companies list
- Years range
- Financial metrics
- All column names

## Current Dataset Coverage

### Companies
- Apple Inc.
- Microsoft Corp.
- Tesla Inc.
- BCG Benchmark Co.

### Years
- 2021, 2022, 2023, 2024

### Financial Metrics (Sample)
- Revenue_Billion
- Gross_Profit_Billion
- Operating_Income_Billion
- Net_Income_Billion
- Total_Assets_Billion
- Total_Equity_Billion
- Operating_Cash_Flow_Billion
- Free_Cash_Flow_Billion
- CAPEX_Billion
- Debt_Billion
- Current_Ratio

## Test Results

**Test Suite:** `test_scope_validation.js`

```
✅ 16/16 Tests Passed (100% Success Rate)
```

### In-Scope Examples (✅ Accepted)
- "What is Apple's revenue?"
- "Show me Microsoft profit in 2023"
- "Compare Tesla and BCGX assets"
- "Calculate ROE for 2024"
- "What are the cash flows?"

### Out-of-Scope Examples (🚫 Rejected)
- "What is the weather today?"
- "Who is the CEO of Amazon?"
- "Tell me a joke"
- "What is Bitcoin price?"
- "Explain quantum physics"
