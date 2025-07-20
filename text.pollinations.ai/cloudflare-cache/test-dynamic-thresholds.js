#!/usr/bin/env node

/**
 * Test script to verify per-token dynamic thresholds are working
 */

async function testDynamicThresholds() {
  console.log('🧪 Testing Per-Token Dynamic Thresholds\n');
  
  const baseUrl = 'http://localhost:8888';
  
  // Test data with different tokens
  const testCases = [
    {
      name: 'OpenAI Token (xCEgiTF_) - Should use 0.818 threshold',
      token: 'xCEgiTF_12345678', // Will be truncated to xCEgiTF_
      body: {
        model: 'openai',
        messages: [
          { role: 'user', content: 'What is machine learning in simple terms?' }
        ]
      }
    },
    {
      name: 'Llama-Roblox Token (FACmMtEj) - Should use 0.513 threshold', 
      token: 'FACmMtEj87654321', // Will be truncated to FACmMtEj
      body: {
        model: 'llama-roblox',
        messages: [
          { role: 'user', content: 'Explain artificial intelligence basics' }
        ]
      }
    },
    {
      name: 'Unknown Token - Should use fallback 0.83 threshold',
      token: 'unknown123456789',
      body: {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Tell me about neural networks' }
        ]
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    console.log(`Token: ${testCase.token.substring(0, 8)}...`);
    
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testCase.token}`
        },
        body: JSON.stringify(testCase.body)
      });
      
      const cacheType = response.headers.get('x-cache-type');
      const similarity = response.headers.get('x-semantic-similarity');
      const cacheModel = response.headers.get('x-cache-model');
      
      console.log(`Status: ${response.status}`);
      console.log(`Cache Type: ${cacheType || 'N/A'}`);
      console.log(`Similarity: ${similarity || 'N/A'}`);
      console.log(`Cache Model: ${cacheModel || 'N/A'}`);
      
      // Don't read the full response to avoid large output
      console.log('✅ Request completed');
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🔍 Check the server logs for dynamic threshold messages:');
  console.log('- Look for "[SEMANTIC_CACHE] Using dynamic threshold X.XXX for token XXXXXXXX"');
  console.log('- Look for "SIMILARITY_SCORE|token:XXXXXXXX|similarity:X.XXX|threshold:X.XXX|result:MISS|model:XXXXX"');
  console.log('\n✨ Dynamic threshold implementation test complete!');
}

testDynamicThresholds().catch(console.error);
