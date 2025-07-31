#!/usr/bin/env node

/**
 * Test script to verify the new Vectorize index is working with semantic cache
 * Tests both cache miss (first request) and cache hit (second similar request)
 */

const STAGING_URL = 'https://pollinations-text-cache-staging.thomash-efd.workers.dev';
const TEST_TOKEN = 'test-token-123'; // From semantic-cache-eligibility.js

async function testSemanticCache() {
    console.log('🧪 Testing semantic cache with new Vectorize index v2...\n');

    // Test request payload
    const testPayload = {
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'user', content: 'What is the capital of France?' }
        ],
        max_tokens: 50,
        temperature: 0.1
    };

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
    };

    try {
        // First request - should be a cache miss and store in new index
        console.log('📤 Sending first request (expecting cache miss)...');
        const start1 = Date.now();
        
        const response1 = await fetch(`${STAGING_URL}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(testPayload)
        });

        const duration1 = Date.now() - start1;
        const result1 = await response1.text();
        
        console.log(`✅ First request completed in ${duration1}ms`);
        console.log(`📊 Response status: ${response1.status}`);
        console.log(`🔍 Cache status: ${response1.headers.get('x-cache-status') || 'not-set'}`);
        console.log(`📝 Response preview: ${result1.substring(0, 200)}...\n`);

        // Wait a moment for the embedding to be processed and stored
        console.log('⏳ Waiting 3 seconds for embedding to be stored...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Second request - should be a cache hit from new index
        console.log('📤 Sending second similar request (expecting cache hit)...');
        const start2 = Date.now();
        
        const response2 = await fetch(`${STAGING_URL}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ...testPayload,
                messages: [
                    { role: 'user', content: 'What is the capital city of France?' } // Slightly different but semantically similar
                ]
            })
        });

        const duration2 = Date.now() - start2;
        const result2 = await response2.text();
        
        console.log(`✅ Second request completed in ${duration2}ms`);
        console.log(`📊 Response status: ${response2.status}`);
        console.log(`🔍 Cache status: ${response2.headers.get('x-cache-status') || 'not-set'}`);
        console.log(`📝 Response preview: ${result2.substring(0, 200)}...\n`);

        // Analysis
        console.log('📈 Analysis:');
        console.log(`⏱️  First request: ${duration1}ms (cache miss expected)`);
        console.log(`⏱️  Second request: ${duration2}ms (cache hit expected)`);
        
        if (duration2 < duration1 * 0.5) {
            console.log('🎉 SUCCESS: Second request was significantly faster - semantic cache is working!');
        } else {
            console.log('⚠️  WARNING: Second request was not significantly faster - cache may not be working');
        }

        // Check if responses are similar (cache hit would return same content)
        if (result1.length > 0 && result2.length > 0) {
            const similar = result1.substring(0, 100) === result2.substring(0, 100);
            console.log(`🔄 Content similarity: ${similar ? 'Similar (cache hit)' : 'Different (cache miss)'}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testSemanticCache().then(() => {
    console.log('\n✅ Test completed');
}).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});
