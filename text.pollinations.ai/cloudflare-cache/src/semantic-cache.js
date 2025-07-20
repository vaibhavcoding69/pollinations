import {
	createEmbeddingService,
	generateEmbedding,
} from "./embedding-service.js";
import {
	SEMANTIC_SIMILARITY_THRESHOLD,
	SEMANTIC_CACHE_ENABLED,
	FALLBACK_THRESHOLD,
} from "./config.js";

// In-memory rolling statistics for dynamic thresholding
const tokenStats = new Map();

class RollingStats {
	constructor(windowSize = 200, targetHitRate = 20) {
		this.scores = [];
		this.windowSize = windowSize;
		this.targetHitRate = targetHitRate;
	}
	
	addScore(score) {
		this.scores.push(score);
		
		if (this.scores.length > this.windowSize) {
			this.scores.shift(); // Remove oldest score
		}
	}
	
	getDynamicThreshold() {
		if (this.scores.length < 7) {
			return 0.9; // Conservative threshold until we have enough samples
		}
		
		// Calculate 80th percentile (20% hit rate target - 80% should be below threshold)
		const sorted = [...this.scores].sort((a, b) => a - b);
		const index = Math.floor(((100 - this.targetHitRate) / 100) * sorted.length);
		return sorted[index] || 0.9;
	}
	
	getStats() {
		return {
			samples: this.scores.length,
			threshold: this.getDynamicThreshold()
		};
	}
}

function getTokenStats(tokenHash) {
	if (!tokenStats.has(tokenHash)) {
		tokenStats.set(tokenHash, new RollingStats());
	}
	return tokenStats.get(tokenHash);
}

// Get dynamic threshold for a specific token using rolling averages
function getDynamicThreshold(token) {
	if (!token) {
		return 0.9;
	}
	
	const tokenHash = token.substring(0, 8);
	const stats = getTokenStats(tokenHash);
	const threshold = stats.getDynamicThreshold();
	
	const { samples } = stats.getStats();
	console.log(`[SEMANTIC_CACHE] Token ${tokenHash}: threshold=${threshold.toFixed(3)} (${samples} samples)`);
	
	return threshold;
}

// Create a semantic cache instance
export function createSemanticCache(env) {
	return {
		r2: env.TEXT_BUCKET,
		vectorize: env.VECTORIZE_INDEX,
		ai: env.AI,
		embeddingService: createEmbeddingService(env.AI),
	};
}

// Find similar text in cache for a specific model and user
export async function findSimilarText(
	cache,
	text,
	modelName = "unknown",
	userPrefix = "anon",
	token = null,
) {
	console.log(
		`[SEMANTIC_CACHE] findSimilarText called with model: ${modelName}, userPrefix: ${userPrefix}, text length: ${text.length}`,
	);

	if (!SEMANTIC_CACHE_ENABLED) {
		console.log("[SEMANTIC_CACHE] Semantic cache is disabled");
		return null;
	}

	// Check if Vectorize is available (not available in local dev)
	if (!cache.vectorize) {
		console.log(
			"[SEMANTIC_CACHE] Vectorize not available, skipping semantic search",
		);
		return null;
	}

	console.log(
		"[SEMANTIC_CACHE] Vectorize is available, proceeding with semantic search",
	);

	try {
		const embedding = await generateEmbedding(cache.embeddingService, text);

		// Query with model-specific AND user-specific metadata filter - TEMPORARILY DISABLED FOR DEBUGGING
		// Get top 3 results for random selection
		const searchResults = await cache.vectorize.query(embedding, {
			topK: 3,
			// filter: {
			//   model: modelName,
			//   userPrefix: userPrefix
			// },
			returnMetadata: "all",
		});

		console.log("[SEMANTIC CACHE] raw result: ", searchResults);

		if (searchResults.matches.length === 0) {
			console.log(
				`[SEMANTIC_CACHE] No matches in Vectorize. Returning similarity 0`,
			);
			
			// Log no matches for threshold analysis (greppable format)
			const tokenHash = token ? token.substring(0, 8) : "anon";
			const dynamicThreshold = getDynamicThreshold(token);
			console.log(`SIMILARITY_SCORE|token:${tokenHash}|similarity:0|threshold:${dynamicThreshold}|result:NO_MATCHES|model:${modelName}`);
			
			return {
				cacheKey: null,
				similarity: 0,
				model: modelName,
				userPrefix,
				aboveThreshold: false,
			};
		}

		// Feed all similarity scores into rolling statistics for dynamic learning
		const tokenHash = token ? token.substring(0, 8) : "anon";
		const stats = getTokenStats(tokenHash);
		searchResults.matches.forEach(match => {
			stats.addScore(match.score);
		});

		// Get dynamic threshold for this token (now updated with new scores)
		const dynamicThreshold = getDynamicThreshold(token);
		
		// Filter matches that are above the dynamic threshold
		const aboveThresholdMatches = searchResults.matches.filter(
			match => match.score >= dynamicThreshold
		);

		if (aboveThresholdMatches.length > 0) {
			// Randomly select one of the matches above threshold
			const randomIndex = Math.floor(Math.random() * aboveThresholdMatches.length);
			const selectedMatch = aboveThresholdMatches[randomIndex];
			
			console.log(
				`[SEMANTIC_CACHE] Found ${aboveThresholdMatches.length} matches above threshold, randomly selected #${randomIndex + 1} with score=${selectedMatch.score}`,
			);
			
			// Log similarity score for threshold analysis (greppable format)
			console.log(`SIMILARITY_SCORE|token:${tokenHash}|similarity:${selectedMatch.score}|threshold:${dynamicThreshold}|result:HIT|model:${modelName}`);
			
			return {
				cacheKey: selectedMatch.id,
				similarity: selectedMatch.score,
				model: selectedMatch.metadata?.model || "unknown",
				userPrefix: selectedMatch.metadata?.userPrefix || "anon",
				aboveThreshold: true,
			};
		}

		// No matches above threshold, return the best match for similarity reporting
		const bestMatch = searchResults.matches[0];
		console.log(
			`[SEMANTIC_CACHE] Best match similarity below threshold: ${bestMatch.score} < ${dynamicThreshold}`,
		);
		
		// Log similarity score for threshold analysis (greppable format)
		console.log(`SIMILARITY_SCORE|token:${tokenHash}|similarity:${bestMatch.score}|threshold:${dynamicThreshold}|result:MISS|model:${modelName}`);
		
		return {
			cacheKey: null,
			similarity: bestMatch.score,
			model: bestMatch.metadata?.model || "unknown",
			userPrefix: bestMatch.metadata?.userPrefix || "anon",
			aboveThreshold: false,
		};
	} catch (error) {
		console.error("[SEMANTIC_CACHE] Error finding similar text:", error);
		return null;
	}
}

// Cache text embedding asynchronously with model and user metadata
export async function cacheTextEmbedding(
	cache,
	cacheKey,
	text,
	modelName = "unknown",
	userPrefix = "anon",
) {
	if (!SEMANTIC_CACHE_ENABLED) return;

	// Check if Vectorize is available (not available in local dev)
	if (!cache.vectorize) {
		console.log(
			"[SEMANTIC_CACHE] Vectorize not available, skipping embedding cache",
		);
		return;
	}

	try {
		const embedding = await generateEmbedding(cache.embeddingService, text);
		// Debug preview of embedding
		if (Array.isArray(embedding)) {
			const preview = embedding
				.slice(0, 5)
				.map((v) => v.toFixed(4))
				.join(", ");
			console.log(
				`[SEMANTIC_CACHE] Embedding preview [${preview}] (dims: ${embedding.length})`,
			);
		}

		// Store vector with model AND user metadata for filtering
		const upsertResult = await cache.vectorize.upsert([
			{
				id: cacheKey,
				values: embedding,
				metadata: {
					model: modelName,
					userPrefix: userPrefix,
					cached_at: new Date().toISOString(),
				},
			},
		]);
		console.log("[SEMANTIC_CACHE] Upsert result:", upsertResult);

		console.log(
			`[SEMANTIC_CACHE] Cached embedding for key: ${cacheKey}, model: ${modelName}, user: ${userPrefix}`,
		);
	} catch (error) {
		console.error("[SEMANTIC_CACHE] Error caching text embedding:", error);
	}
}
