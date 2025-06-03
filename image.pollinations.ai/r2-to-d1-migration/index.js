/**
 * R2 to D1 Migration Worker
 * 
 * A dedicated worker for migrating metadata from R2 to D1.
 * Features:
 * - Batch processing with configurable batch size
 * - Rate limiting to avoid "Too many API requests" errors
 * - Simple UI for monitoring migration progress
 */

// Configuration
const BATCH_SIZE = 500; // Reduced from 5000 to avoid rate limits
const DELAY_BETWEEN_BATCHES_MS = 2000; // Add delay between batches to avoid rate limits

// Global tracking for migration progress
let totalProcessed = 0;

// Handle all routes
async function handleRequest(request, env) {
  // Add request to env for accessing URL in other functions
  env.REQUEST = request;
  const url = new URL(request.url);
  
  // Serve the web UI
  if (url.pathname === "/" || url.pathname === "") {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>R2 to D1 Migration Tool</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            h3 { margin-top: 10px; margin-bottom: 10px; color: #555; }
            .buttons { margin-bottom: 15px; }
            .btn { display: inline-block; margin: 5px; padding: 8px 15px; background-color: #4CAF50; color: white; 
                   text-decoration: none; border-radius: 4px; border: none; cursor: pointer; }
            .btn:hover { opacity: 0.9; }
            .btn-info { background-color: #2196F3; }
            .btn-danger { background-color: #f44336; }
            pre { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
            .phase-divider { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>R2 to D1 Migration Tool</h1>
          <p>Migrate metadata from R2 to D1 database with rate limiting.</p>
          
          <div class="buttons">
            <h3>Standard Migration</h3>
            <button onclick="window.location='/create-schema'" class="btn">1. Create Schema</button>
            <button onclick="window.location='/count-objects'" class="btn">2. Count Objects</button>
            <button onclick="window.location='/migrate-all?batches=100'" class="btn">3. Migrate 100 Batches</button>
            <button onclick="window.location='/status'" class="btn">4. Check Status</button>
            <button onclick="window.location='/reset'" class="btn btn-danger">5. Reset</button>
          </div>
          
          <div class="buttons" style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 20px;">
            <h3>Two-Phase Migration (for 45M+ objects)</h3>
            <button onclick="window.location='/create-keys-table'" class="btn">1. Create Keys Table</button>
            <button onclick="window.location='/list-all-keys?batch_size=10000'" class="btn">2. List All Keys (10,000 per batch)</button>
            <button onclick="window.location='/migrate-from-keys?batches=100'" class="btn">3. Migrate From Keys (100 batches)</button>
            <button onclick="window.location='/migrate-from-keys?batches=500'" class="btn">3. Migrate From Keys (500 batches)</button>
          </div>
          
          <p><small>Follow the numbered steps in sequence. Uses ${BATCH_SIZE} objects per batch with rate limiting to avoid API request errors.</small></p>
          <p><small><strong>Parallel Processing:</strong> Use the status endpoint to get cursor values, then run migrations in parallel with: <code>/migrate-all?batches=100&cursor=YOUR_CURSOR</code></small></p>
        </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } });
  }
  
  // Create database schema
  if (url.pathname === "/create-schema") {
    const result = await createSchema(env);
    return new Response(JSON.stringify(result, null, 2), { 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  // Create keys table schema
  if (url.pathname === "/create-keys-table") {
    const result = await createKeysTable(env);
    return new Response(JSON.stringify(result, null, 2), { 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  // List all keys in batches and save to D1 table
  if (url.pathname === "/list-all-keys") {
    const batchSize = url.searchParams.get("batch_size") ? parseInt(url.searchParams.get("batch_size")) : 10000;
    const result = await listAllKeysToTable(env, batchSize);
    return new Response(JSON.stringify(result, null, 2), { 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  // Migrate metadata for keys in the keys table
  if (url.pathname === "/migrate-from-keys") {
    const batchSize = url.searchParams.get("batch_size") ? parseInt(url.searchParams.get("batch_size")) : 500;
    const batchCount = url.searchParams.get("batches") ? parseInt(url.searchParams.get("batches")) : 10;
    const result = await migrateFromKeysTable(env, batchSize, batchCount);
    return new Response(JSON.stringify(result, null, 2), { 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  // Count objects in R2
  if (url.pathname === "/count-objects") {
    const result = await countObjects(env);
    return new Response(JSON.stringify(result, null, 2), { 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  // Removed single batch migration endpoint as it's not needed for large migrations
  
  // Auto-migrate multiple batches
  if (url.pathname === "/migrate-all") {
    const batchCount = url.searchParams.get("batches") ? parseInt(url.searchParams.get("batches")) : 10;
    const startCursor = url.searchParams.get("cursor");
    const result = await processBatches(env, batchCount, startCursor);
    return new Response(JSON.stringify(result, null, 2), { 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  // Get migration status
  if (url.pathname === "/status") {
    const result = await getStatus(env);
    return new Response(JSON.stringify(result, null, 2), { 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  // Reset the database
  if (url.pathname === "/reset") {
    const result = await resetDatabase(env);
    return new Response(JSON.stringify(result, null, 2), { 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  // Fallback for unknown routes
  return new Response("Not found", { status: 404 });
}

// Create database schema
async function createSchema(env) {
  try {
    console.log("Creating schema with cache_key column...");
    // Create the table with a primary key
    const createTableResult = await env.METADATA_DB.exec(
      "CREATE TABLE IF NOT EXISTS image_metadata (cache_key TEXT PRIMARY KEY, metadata TEXT)"
    );
    
    // Create an index on the cache_key column
    const createIndexResult = await env.METADATA_DB.exec(
      "CREATE INDEX IF NOT EXISTS idx_cache_key ON image_metadata (cache_key)"
    );
    
    return { 
      success: true, 
      message: "Schema created successfully",
      createTable: createTableResult,
      createIndex: createIndexResult
    };
  } catch (error) {
    console.error("Error creating schema:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Create keys table schema
async function createKeysTable(env) {
  try {
    // Create a separate table just for cache keys
    const createTableResult = await env.METADATA_DB.exec(
      "CREATE TABLE IF NOT EXISTS r2_keys (cache_key TEXT PRIMARY KEY, processed INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    );
    
    // Create an index on the processed column for efficient querying
    const createIndexResult = await env.METADATA_DB.exec(
      "CREATE INDEX IF NOT EXISTS idx_processed ON r2_keys (processed)"
    );
    
    return { 
      success: true, 
      message: "Keys table created successfully",
      createTable: createTableResult,
      createIndex: createIndexResult
    };
  } catch (error) {
    console.error("Error creating keys table:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// List all keys and save them to the D1 database
async function listAllKeysToTable(env, batchSize = 10000, maxBatches = 10) {
  console.log(`[List-Keys] Starting to list ${maxBatches} batches of keys with ${batchSize} per batch`);
  const startTime = Date.now();
  let batchCount = 0;
  let totalListed = 0;
  let totalInserted = 0;
  let cursor = "";
  const errors = [];
  
  try {
    // Get starting cursor from URL if provided
    const url = new URL(env.REQUEST.url);
    const startCursor = url.searchParams.get('cursor') || "";
    cursor = startCursor;
    
    // Process a limited number of batches
    while(batchCount < maxBatches) {
      batchCount++;
      console.log(`[List-Keys] Processing batch #${batchCount} with cursor ${cursor}`);
      
      // List objects from R2 with the cursor
      let listing;
      try {
        // Only include cursor parameter if it's not empty
        const listOptions = {
          limit: batchSize
        };
        
        // Only add cursor if it's not empty
        if (cursor && cursor.trim() !== "") {
          listOptions.cursor = cursor;
        }
        
        listing = await env.IMAGE_BUCKET.list(listOptions);
      } catch (error) {
        console.error(`[List-Keys] Error listing objects:`, error);
        errors.push(`R2 listing error: ${error.message}`);
        break;
      }
      
      // If no objects returned, we're done
      if (!listing.objects || listing.objects.length === 0) {
        console.log(`[List-Keys] No more objects to list`);
        break;
      }
      
      const keys = listing.objects.map(obj => obj.key);
      totalListed += keys.length;
      
      // Prepare batch insert statements
      const batchStatements = [];
      const statement = env.METADATA_DB.prepare(
        "INSERT OR IGNORE INTO r2_keys (cache_key) VALUES (?)"
      );
      
      for (const key of keys) {
        batchStatements.push(statement.bind(key));
      }
      
      // Execute batch insert
      if (batchStatements.length > 0) {
        try {
          const batchResults = await env.METADATA_DB.batch(batchStatements);
          totalInserted += batchStatements.length;
          console.log(`[List-Keys] Inserted ${batchStatements.length} keys into D1`);
        } catch (error) {
          console.error("[List-Keys] Batch insert error:", error);
          errors.push(`Batch insert error: ${error.message}`);
          // Continue despite errors
        }
      }
      
      // If no more objects to list, we're done
      if (!listing.truncated) {
        console.log(`[List-Keys] No more objects to list (not truncated)`);
        
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const keysPerSecond = totalListed / elapsedSeconds;
        
        return new Response(generateCompletionHtml({
          success: true,
          batchCount,
          totalListed,
          totalInserted,
          elapsedSeconds,
          keysPerSecond: keysPerSecond.toFixed(2),
          message: "All keys have been listed and saved to D1"
        }), { 
          headers: { 'Content-Type': 'text/html' } 
        });
      }
      
      // Update cursor for next batch
      cursor = listing.cursor;
      
      // Add a small delay to avoid rate limiting
      if (listing.truncated) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // After processing maxBatches, redirect to continue with next set
    if (cursor) {
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const keysPerSecond = totalListed / elapsedSeconds;
      
      // Create URL for continuation
      const continueUrl = new URL(env.REQUEST.url);
      continueUrl.pathname = "/list-all-keys";
      continueUrl.searchParams.set("cursor", cursor);
      
      // Return HTML with stats and auto-redirect
      const html = generateContinuationHtml({
        batchCount,
        totalListed,
        totalInserted,
        elapsedSeconds,
        keysPerSecond,
        cursor,
        continueUrl: continueUrl.toString()
      });
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    
    // Fallback response if we get here
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const keysPerSecond = totalListed / elapsedSeconds;
    
    return new Response(JSON.stringify({
      success: errors.length === 0,
      batchCount,
      totalListed,
      totalInserted,
      elapsedSeconds,
      keysPerSecond: keysPerSecond.toFixed(2),
      errors: errors.length > 0 ? errors : undefined
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error(`[List-Keys] Unexpected error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      batchCount,
      totalListed,
      totalInserted,
      cursor, // Return last cursor for manual resuming
      errors: errors.length > 0 ? errors : undefined
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// Generate HTML for the listing continuation page
function generateContinuationHtml({ batchCount, totalListed, totalInserted, elapsedSeconds, keysPerSecond, cursor, continueUrl }) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Key Listing Progress</title>
        <script>
          // JavaScript redirect is more reliable than meta refresh
          setTimeout(function() {
            window.location.href = "${continueUrl}";
          }, 2000);
        </script>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .container { max-width: 800px; margin: 0 auto; }
          .progress { background: #f0f0f0; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .button { display: inline-block; background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
          .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Key Listing in Progress</h1>
          <div class="progress">
            <h2>Progress Update</h2>
            <div class="stats">
              <div>Batches processed: <strong>${batchCount}</strong></div>
              <div>Keys listed: <strong>${totalListed}</strong></div>
              <div>Keys inserted: <strong>${totalInserted}</strong></div>
              <div>Time elapsed: <strong>${elapsedSeconds.toFixed(2)} seconds</strong></div>
              <div>Speed: <strong>${keysPerSecond.toFixed(2)} keys/sec</strong></div>
            </div>
            <p>Current cursor: <pre>${cursor}</pre></p>
            <p>Continuing in 2 seconds...</p>
          </div>
          <p>If the page doesn't redirect automatically:</p>
          <a href="${continueUrl}" class="button">Continue Listing</a>
          <p><a href="/">Return to main page</a></p>
        </div>
      </body>
    </html>
  `;
}

// Generate HTML for the completion page
function generateCompletionHtml({ batchCount, totalListed, totalInserted, elapsedSeconds, keysPerSecond, message }) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Key Listing Complete</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .container { max-width: 800px; margin: 0 auto; }
          .success { background: #dff0d8; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .button { display: inline-block; background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Key Listing Complete</h1>
          <div class="success">
            <h2>Success!</h2>
            <p>${message}</p>
            <div class="stats">
              <div>Batches processed: <strong>${batchCount}</strong></div>
              <div>Keys listed: <strong>${totalListed}</strong></div>
              <div>Keys inserted: <strong>${totalInserted}</strong></div>
              <div>Time elapsed: <strong>${elapsedSeconds.toFixed(2)} seconds</strong></div>
              <div>Speed: <strong>${keysPerSecond.toFixed(2)} keys/sec</strong></div>
            </div>
          </div>
          <p><a href="/" class="button">Return to main page</a></p>
        </div>
      </body>
    </html>
  `;
}

// Migrate metadata for keys in the keys table
async function migrateFromKeysTable(env, batchSize = 500, batchCount = 10) {
  console.log(`[Migrate-From-Keys] Processing ${batchCount} batches of ${batchSize} keys each`);
  
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalErrors = 0;
  let allErrors = [];
  let startTime = Date.now();
  
  // Process batches sequentially with rate limiting
  for (let batch = 0; batch < batchCount; batch++) {
    console.log(`[Migrate-From-Keys] Processing batch #${batch + 1}/${batchCount}`);
    
    // Get a batch of unprocessed keys from the keys table
    const keysResult = await env.METADATA_DB.prepare(
      `SELECT cache_key FROM r2_keys 
       WHERE processed = 0 
       LIMIT ?`
    ).bind(batchSize).all();
    
    if (!keysResult.results || keysResult.results.length === 0) {
      console.log(`[Migrate-From-Keys] No more unprocessed keys found`);
      break;
    }
    
    const keys = keysResult.results.map(row => row.cache_key);
    console.log(`[Migrate-From-Keys] Found ${keys.length} unprocessed keys`);
    
    // Get metadata for each key from R2
    const metadataBatchStatements = [];
    const updateStatusStatements = [];
    
    for (const key of keys) {
      try {
        // Get the object metadata from R2
        const headResult = await env.IMAGE_BUCKET.head(key);
        if (!headResult) {
          console.log(`[Migrate-From-Keys] Key not found in R2: ${key}`);
          // Mark as processed even if not found, to avoid retrying
          updateStatusStatements.push(
            env.METADATA_DB.prepare("UPDATE r2_keys SET processed = -1 WHERE cache_key = ?").bind(key)
          );
          continue;
        }
        
        // Get all metadata from the head result
        const metadata = {
          httpMetadata: headResult.httpMetadata || {},
          customMetadata: headResult.customMetadata || {}
        };
        
        // Create statements for inserting metadata
        metadataBatchStatements.push(
          env.METADATA_DB.prepare(
            "INSERT OR REPLACE INTO image_metadata (cache_key, metadata) VALUES (?, ?)"
          ).bind(key, JSON.stringify(metadata))
        );
        
        // Create statements for updating processed status
        updateStatusStatements.push(
          env.METADATA_DB.prepare("UPDATE r2_keys SET processed = 1 WHERE cache_key = ?").bind(key)
        );
        
        totalProcessed++;
      } catch (error) {
        console.error(`[Migrate-From-Keys] Error processing key ${key}:`, error);
        totalErrors++;
        allErrors.push(`Error for key ${key}: ${error.message}`);
        // Mark as error in the keys table
        updateStatusStatements.push(
          env.METADATA_DB.prepare("UPDATE r2_keys SET processed = -2 WHERE cache_key = ?").bind(key)
        );
      }
    }
    
    // Execute batch inserts for metadata
    if (metadataBatchStatements.length > 0) {
      try {
        await env.METADATA_DB.batch(metadataBatchStatements);
        totalInserted += metadataBatchStatements.length;
        console.log(`[Migrate-From-Keys] Inserted ${metadataBatchStatements.length} metadata records`);
      } catch (error) {
        console.error("[Migrate-From-Keys] Error inserting metadata:", error);
        allErrors.push(`Batch metadata insert error: ${error.message}`);
      }
    }
    
    // Execute batch updates for processed status
    if (updateStatusStatements.length > 0) {
      try {
        await env.METADATA_DB.batch(updateStatusStatements);
        console.log(`[Migrate-From-Keys] Updated status for ${updateStatusStatements.length} keys`);
      } catch (error) {
        console.error("[Migrate-From-Keys] Error updating key status:", error);
        allErrors.push(`Batch status update error: ${error.message}`);
      }
    }
    
    // Add delay between batches to avoid rate limiting
    if (batch < batchCount - 1) {
      console.log(`[Migrate-From-Keys] Adding delay of 2000ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const keysPerSecond = totalProcessed > 0 ? totalProcessed / elapsedSeconds : 0;
  
  // Get overall migration progress
  const progressResult = await env.METADATA_DB.prepare(
    `SELECT 
      (SELECT COUNT(*) FROM r2_keys) AS total_keys,
      (SELECT COUNT(*) FROM r2_keys WHERE processed > 0) AS processed_keys,
      (SELECT COUNT(*) FROM r2_keys WHERE processed < 0) AS error_keys
    `
  ).first();
  
  return {
    success: totalErrors === 0,
    batchesProcessed: Math.min(batchCount, Math.ceil(totalProcessed / batchSize)),
    totalProcessed,
    totalInserted,
    totalErrors,
    elapsedSeconds: elapsedSeconds.toFixed(2),
    keysPerSecond: keysPerSecond.toFixed(2),
    progress: progressResult ? {
      totalKeys: progressResult.total_keys,
      processedKeys: progressResult.processed_keys,
      errorKeys: progressResult.error_keys,
      percentComplete: progressResult.total_keys > 0 ? 
        (progressResult.processed_keys / progressResult.total_keys * 100).toFixed(2) + '%' : '0%'
    } : null,
    errors: allErrors.length > 0 ? allErrors.slice(0, 10) : undefined // Only return first 10 errors
  };
}

// Count total objects in the R2 bucket
async function countObjects(env) {
  try {
    let count = 0;
    let cursor;
    let truncated = true;
    
    while (truncated) {
      const options = { limit: 1000 };
      if (typeof cursor === 'string' && cursor.trim() !== '') {
        options.cursor = cursor;
      }
      
      const listing = await env.IMAGE_BUCKET.list(options);
      count += listing.objects.length;
      cursor = listing.cursor;
      truncated = listing.truncated;
      
      // To avoid rate limiting during counting
      if (truncated) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return { success: true, count };
  } catch (error) {
    console.error("Error counting objects:", error);
    return { success: false, error: error.message };
  }
}

// Migrate a batch of objects from R2 to D1
async function migrateBatch(env, cursor) {
  console.log(`Starting migration batch with cursor: ${cursor || 'none'}`);
  
  let processed = 0;
  let inserted = 0;
  let errors = [];
  
  try {
    // Get a batch of objects from R2
    const options = { limit: BATCH_SIZE };
    
    // Only add cursor if it's a non-empty string
    if (typeof cursor === 'string' && cursor.trim() !== '') {
      options.cursor = cursor;
    }
    
    const listing = await env.IMAGE_BUCKET.list(options);
    
    processed = listing.objects.length;
    console.log(`Processing ${processed} objects`);
    
    if (processed === 0) {
      return {
        processed: 0,
        inserted: 0,
        errors: [],
        hasMore: false,
        cursor: null
      };
    }
    
    // Prepare batch statements
    const batchStatements = [];
    const stmt = env.METADATA_DB.prepare(
      "INSERT OR REPLACE INTO image_metadata (cache_key, metadata) VALUES (?, ?)"
    );
    
    // Process each object with rate limiting
    for (let i = 0; i < listing.objects.length; i++) {
      const object = listing.objects[i];
      
      try {
        // Add small delay every 10 objects to avoid rate limiting
        if (i > 0 && i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Use head() instead of get() for better performance since we only need metadata
        const metadata = await env.IMAGE_BUCKET.head(object.key);
        
        if (!metadata) {
          errors.push(`Object ${object.key} not found`);
          continue;
        }
        
        if (metadata && metadata.customMetadata) {
          const metadataJson = JSON.stringify(metadata.customMetadata);
          batchStatements.push(stmt.bind(object.key, metadataJson));
        } else {
          errors.push(`No metadata for ${object.key}`);
        }
      } catch (error) {
        console.error(`Error processing ${object.key}:`, error);
        errors.push(`Error with ${object.key}: ${error.message}`);
      }
    }
    
    // Execute batch insert with transaction
    if (batchStatements.length > 0) {
      try {
        const batchResults = await env.METADATA_DB.batch(batchStatements);
        inserted = batchStatements.length;
        console.log(`Inserted ${inserted} records into D1`);
      } catch (error) {
        console.error("Batch insert error:", error);
        errors.push(`Batch insert error: ${error.message}`);
      }
    }
    
    // Update global counter
    totalProcessed += processed;
    
    return {
      processed,
      inserted,
      errors,
      hasMore: listing.truncated,
      cursor: listing.cursor
    };
  } catch (error) {
    console.error("Error in migrateBatch:", error);
    return {
      processed,
      inserted,
      errors: [`${error.name}: ${error.message}`],
      hasMore: true,
      cursor
    };
  }
}

// Process a specific number of batches in sequence with rate limiting
async function processBatches(env, batchCount, startCursor = undefined) {
  console.log(`[Auto-Migration] Starting to process ${batchCount} batches${startCursor ? ' with custom cursor' : ''}`);
  
  let cursor = startCursor || undefined; // Use provided cursor or start from beginning
  let totalProcessed = 0;
  let totalInserted = 0;
  let allErrors = [];
  let results = [];
  
  // Process the specified number of batches
  for (let i = 1; i <= batchCount; i++) {
    try {
      console.log(`[Auto-Migration] Processing batch #${i}...`);
      
      const result = await migrateBatch(env, cursor);
      totalProcessed += result.processed;
      totalInserted += result.inserted;
      
      if (result.errors && result.errors.length > 0) {
        allErrors = [...allErrors, ...result.errors];
      }
      
      console.log(`[Auto-Migration] Batch #${i} complete: ${result.processed} processed, ${result.inserted} inserted, ${result.errors ? result.errors.length : 0} errors`);
      
      // Save the batch result
      results.push({
        batchNumber: i,
        processed: result.processed,
        inserted: result.inserted,
        errors: result.errors ? result.errors.length : 0
      });
      
      // Update cursor for next batch - only if it's a valid string
      if (typeof result.cursor === 'string' && result.cursor.trim() !== '') {
        cursor = result.cursor;
        console.log(`[Auto-Migration] Using cursor for next batch: ${cursor.substring(0, 20)}...`);
      } else {
        cursor = undefined;
      }
      
      // If no more objects, we're done
      if (!result.hasMore) {
        console.log(`[Auto-Migration] No more objects to process after batch #${i}`);
        break;
      }
      
      // Add delay between batches to avoid rate limiting
      if (i < batchCount) {
        console.log(`[Auto-Migration] Adding delay of ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    } catch (error) {
      console.error(`[Auto-Migration] Error processing batch #${i}: ${error.message}`);
      allErrors.push(`Batch ${i} error: ${error.message}`);
      break;
    }
  }
  
  return {
    batchesProcessed: results.length,
    totalProcessed,
    totalInserted,
    errorCount: allErrors.length,
    errors: allErrors.slice(0, 10), // Return only first 10 errors to keep response size reasonable
    results
  };
}

// Get migration status
async function getStatus(env) {
  const countResult = await env.METADATA_DB.prepare(
    "SELECT COUNT(*) as count FROM image_metadata"
  ).first();
  
  // Get total objects in R2 for comparison
  const bucketResult = await countObjects(env);
  
  // Get a cursor for parallel processing
  let parallelCursors = [];
  try {
    // Get multiple cursor positions for parallel processing
    const NUM_CURSORS = 5;
    let listing = null;
    let cursor = undefined;
    
    for (let i = 0; i < NUM_CURSORS; i++) {
      listing = await env.IMAGE_BUCKET.list({
        limit: bucketResult.count / (NUM_CURSORS + 1) * (i + 1),
        cursor: undefined
      });
      
      if (listing && listing.cursor) {
        parallelCursors.push({
          position: (i + 1),
          approximatePosition: `${Math.round((i + 1) * 100 / (NUM_CURSORS + 1))}%`,
          cursor: listing.cursor
        });
      }
    }
  } catch (error) {
    console.error("Error getting parallel cursors:", error);
  }
  
  const rows = await env.METADATA_DB.prepare(
    "SELECT cache_key, metadata FROM image_metadata LIMIT 50"
  ).all();
  
  // Parse the JSON metadata for each row
  const processedRows = rows.results.map(row => {
    try {
      return {
        key: row.cache_key,
        metadata: JSON.parse(row.metadata)
      };
    } catch (error) {
      return {
        key: row.cache_key,
        metadata: { error: "Failed to parse JSON" }
      };
    }
  });
  
  return {
    processed: {
      count: countResult.count,
      totalProcessed
    },
    progress: countResult.count > 0 ? 
      `${Math.round(countResult.count * 100 / bucketResult.count)}% complete (${countResult.count}/${bucketResult.count})` : 
      "0% complete",
    parallelCursors,
    parallelExample: parallelCursors.length > 0 ? 
      `/migrate-all?batches=100&cursor=${parallelCursors[0].cursor.substring(0, 30)}...` : 
      "No cursor available yet",
    recentObjects: processedRows.slice(0, 5)
  };
}

// Reset the database
async function resetDatabase(env) {
  try {
    await env.METADATA_DB.exec("DROP TABLE IF EXISTS image_metadata");
    await createSchema(env);
    totalProcessed = 0;
    return { success: true, message: "Database reset successfully" };
  } catch (error) {
    console.error("Error resetting database:", error);
    return { success: false, error: error.message };
  }
}

// Export the fetch handler
export default {
  fetch: handleRequest
};
