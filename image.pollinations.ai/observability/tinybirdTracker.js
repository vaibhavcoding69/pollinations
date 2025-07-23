import dotenv from "dotenv";
import debug from "debug";

// Minimal Tinybird telemetry helper copied from text endpoint
// (simplified – no model pricing lookup needed for image endpoint)

dotenv.config();

const log = debug("pollinations:tinybird");
const errorLog = debug("pollinations:tinybird:error");

const TINYBIRD_API_URL =
    process.env.TINYBIRD_API_URL || "https://api.europe-west2.gcp.tinybird.co";
const TINYBIRD_API_KEY = process.env.TINYBIRD_API_KEY;

/**
 * Send an event to Tinybird observability pipeline (llm_events table)
 * @param {Object} eventData – arbitrary event data
 */
export async function sendTinybirdEvent(eventData) {
    if (!TINYBIRD_API_KEY) {
        log("TINYBIRD_API_KEY not set – skipping Tinybird telemetry");
        return;
    }

    const event = {
        start_time: eventData.startTime?.toISOString(),
        end_time: eventData.endTime?.toISOString(),
        id: eventData.requestId,
        message_id: eventData.requestId,
        model: eventData.model || "image",
        duration: eventData.duration,
        standard_logging_object_status: eventData.status,
        log_event_type: "image_generation",
        project: eventData.project || "image.pollinations.ai",
        environment: eventData.environment || process.env.NODE_ENV || "development",
        // Spread remaining fields so we preserve anything extra (e.g. error)
        ...eventData,
    };

    try {
        const response = await fetch(
            `${TINYBIRD_API_URL}/v0/events?name=llm_events`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${TINYBIRD_API_KEY}`,
                },
                body: JSON.stringify(event),
            },
        );

        const text = await response.text().catch(() => "(no body)");
        if (!response.ok) {
            errorLog(`Tinybird error ${response.status}: ${text}`);
        } else {
            log(`Tinybird ok ${response.status}: ${text}`);
        }
    } catch (err) {
        errorLog("Failed sending Tinybird telemetry", err);
    }
}
