#!/usr/bin/env node

/**
 * Analyze similarity scores from logs to calculate optimal thresholds per token
 * Target: 20% cache hit rate (80th percentile threshold)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseLogLine(line) {
  // Parse format: SIMILARITY_SCORE|token:abc12345|similarity:0.85|threshold:0.92|result:MISS|model:gpt-4
  const parts = line.split('|');
  if (parts.length !== 6 || !parts[0].includes('SIMILARITY_SCORE')) {
    return null;
  }
  
  const token = parts[1].split(':')[1];
  const similarity = parseFloat(parts[2].split(':')[1]);
  const currentThreshold = parseFloat(parts[3].split(':')[1]);
  const result = parts[4].split(':')[1];
  const model = parts[5].split(':')[1];
  
  return {
    token,
    similarity,
    currentThreshold,
    result,
    model
  };
}

function calculatePercentile(scores, percentile) {
  if (scores.length === 0) return 0;
  
  const sorted = scores.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function analyzeThresholds(logFile) {
  console.log('🔍 Analyzing similarity scores for dynamic thresholding...\n');
  
  const logContent = fs.readFileSync(logFile, 'utf8');
  const lines = logContent.split('\n').filter(line => line.trim());
  
  // Parse all log entries
  const entries = [];
  for (const line of lines) {
    const parsed = parseLogLine(line.trim().replace(/"/g, ''));
    if (parsed) {
      entries.push(parsed);
    }
  }
  
  console.log(`📊 Parsed ${entries.length} similarity score entries\n`);
  
  // Group by token
  const tokenData = {};
  
  for (const entry of entries) {
    if (!tokenData[entry.token]) {
      tokenData[entry.token] = {
        scores: [],
        models: new Set(),
        currentThreshold: entry.currentThreshold,
        hits: 0,
        misses: 0
      };
    }
    
    tokenData[entry.token].scores.push(entry.similarity);
    tokenData[entry.token].models.add(entry.model);
    
    if (entry.result === 'HIT') {
      tokenData[entry.token].hits++;
    } else {
      tokenData[entry.token].misses++;
    }
  }
  
  console.log('🎯 Per-Token Threshold Analysis\n');
  console.log('Token'.padEnd(12) + 'Samples'.padEnd(10) + 'Current'.padEnd(10) + 'Hit Rate'.padEnd(12) + '10% Target'.padEnd(12) + '20% Target'.padEnd(12) + '50% Target'.padEnd(12) + 'Models');
  console.log('-'.repeat(112));
  
  const results = {};
  
  for (const [token, data] of Object.entries(tokenData)) {
    const totalRequests = data.hits + data.misses;
    const currentHitRate = (data.hits / totalRequests * 100).toFixed(1);
    
    // Calculate 90th percentile (10% hit rate target)
    const optimalThreshold10 = calculatePercentile(data.scores, 90);
    
    // Calculate 80th percentile (20% hit rate target)
    const optimalThreshold20 = calculatePercentile(data.scores, 80);
    
    // Calculate 50th percentile (50% hit rate target)
    const optimalThreshold50 = calculatePercentile(data.scores, 50);
    
    // Calculate what hit rates these would achieve
    const wouldHit10 = data.scores.filter(s => s >= optimalThreshold10).length;
    const wouldHit20 = data.scores.filter(s => s >= optimalThreshold20).length;
    const wouldHit50 = data.scores.filter(s => s >= optimalThreshold50).length;
    const projectedHitRate10 = (wouldHit10 / data.scores.length * 100).toFixed(1);
    const projectedHitRate20 = (wouldHit20 / data.scores.length * 100).toFixed(1);
    const projectedHitRate50 = (wouldHit50 / data.scores.length * 100).toFixed(1);
    
    results[token] = {
      samples: data.scores.length,
      currentThreshold: data.currentThreshold,
      currentHitRate: parseFloat(currentHitRate),
      optimalThreshold10: optimalThreshold10,
      optimalThreshold20: optimalThreshold20,
      optimalThreshold50: optimalThreshold50,
      projectedHitRate10: parseFloat(projectedHitRate10),
      projectedHitRate20: parseFloat(projectedHitRate20),
      projectedHitRate50: parseFloat(projectedHitRate50),
      models: Array.from(data.models)
    };
    
    console.log(
      token.padEnd(12) +
      data.scores.length.toString().padEnd(10) +
      data.currentThreshold.toFixed(2).padEnd(10) +
      `${currentHitRate}%`.padEnd(12) +
      `${optimalThreshold10.toFixed(3)} (${projectedHitRate10}%)`.padEnd(12) +
      `${optimalThreshold20.toFixed(3)} (${projectedHitRate20}%)`.padEnd(12) +
      `${optimalThreshold50.toFixed(3)} (${projectedHitRate50}%)`.padEnd(12) +
      Array.from(data.models).join(',')
    );
  }
  
  console.log('\n📈 Summary Statistics:');
  const allTokens = Object.keys(results);
  const avgCurrentHitRate = allTokens.reduce((sum, token) => sum + results[token].currentHitRate, 0) / allTokens.length;
  const avgProjectedHitRate10 = allTokens.reduce((sum, token) => sum + results[token].projectedHitRate10, 0) / allTokens.length;
  const avgProjectedHitRate20 = allTokens.reduce((sum, token) => sum + results[token].projectedHitRate20, 0) / allTokens.length;
  const avgProjectedHitRate50 = allTokens.reduce((sum, token) => sum + results[token].projectedHitRate50, 0) / allTokens.length;
  
  console.log(`Current average hit rate: ${avgCurrentHitRate.toFixed(1)}%`);
  console.log(`Projected average hit rate (10% target): ${avgProjectedHitRate10.toFixed(1)}%`);
  console.log(`Projected average hit rate (20% target): ${avgProjectedHitRate20.toFixed(1)}%`);
  console.log(`Projected average hit rate (50% target): ${avgProjectedHitRate50.toFixed(1)}%`);
  
  console.log('\n🔧 Recommended Dynamic Thresholds (10% Target):');
  console.log('```javascript');
  console.log('const DYNAMIC_THRESHOLDS_10 = {');
  for (const [token, data] of Object.entries(results)) {
    console.log(`  "${token}": ${data.optimalThreshold10.toFixed(3)}, // ${data.projectedHitRate10}% hit rate`);
  }
  console.log('};');
  console.log('```');
  
  console.log('\n🔧 Recommended Dynamic Thresholds (20% Target):');
  console.log('```javascript');
  console.log('const DYNAMIC_THRESHOLDS_20 = {');
  for (const [token, data] of Object.entries(results)) {
    console.log(`  "${token}": ${data.optimalThreshold20.toFixed(3)}, // ${data.projectedHitRate20}% hit rate`);
  }
  console.log('};');
  console.log('```');
  
  console.log('\n🔧 Recommended Dynamic Thresholds (50% Target):');
  console.log('```javascript');
  console.log('const DYNAMIC_THRESHOLDS_50 = {');
  for (const [token, data] of Object.entries(results)) {
    console.log(`  "${token}": ${data.optimalThreshold50.toFixed(3)}, // ${data.projectedHitRate50}% hit rate`);
  }
  console.log('};');
  console.log('```');
  
  // Identify tokens with significant threshold changes
  console.log('\n⚡ Threshold Comparison (Current vs 10% vs 20% vs 50%):');
  for (const [token, data] of Object.entries(results)) {
    console.log(`${token}:`);
    console.log(`  Current: ${data.currentThreshold.toFixed(3)} (${data.currentHitRate}% hit rate)`);
    console.log(`  10% target: ${data.optimalThreshold10.toFixed(3)} (${data.projectedHitRate10}% hit rate)`);
    console.log(`  20% target: ${data.optimalThreshold20.toFixed(3)} (${data.projectedHitRate20}% hit rate)`);
    console.log(`  50% target: ${data.optimalThreshold50.toFixed(3)} (${data.projectedHitRate50}% hit rate)`);
    console.log('');
  }
  
  return results;
}

// Run analysis
const logFile = path.join(__dirname, 'logs.txt');
if (!fs.existsSync(logFile)) {
  console.error('❌ logs.txt not found. Run: npm run logs:staging | grep "SIMILARITY_SCORE" > logs.txt');
  process.exit(1);
}

const results = analyzeThresholds(logFile);
