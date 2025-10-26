import { promises as fs } from "fs";
import path from "path";
import debug from "debug";

const log = debug("pollinations:uptime");
const errorLog = debug("pollinations:uptime:error");

/**
 * Simple in-memory uptime monitor with file persistence
 * Stores uptime check history for models
 */
class UptimeMonitor {
    constructor() {
        this.uptimeData = {}; // modelName -> { history: [], lastCheck: timestamp, currentStatus: 'online'|'offline'|'unknown' }
        this.historyLength = 288; // Keep 288 data points (24 hours with 5-min intervals)
        this.dataFile = path.join(process.cwd(), "uptime_data.json");
        this.saveInterval = 5 * 60 * 1000; // Save every 5 minutes
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.loadData();
            log(`Loaded uptime data for ${Object.keys(this.uptimeData).length} models`);
        } catch (error) {
            if (error.code !== "ENOENT") {
                errorLog("Error loading uptime data:", error);
            }
            log("Starting with empty uptime data");
        }

        // Set up periodic saving
        setInterval(() => this.saveData(), this.saveInterval);
        
        this.initialized = true;
    }

    async loadData() {
        const data = await fs.readFile(this.dataFile, "utf8");
        this.uptimeData = JSON.parse(data);
    }

    async saveData() {
        try {
            await fs.writeFile(this.dataFile, JSON.stringify(this.uptimeData, null, 2), "utf8");
            log(`Saved uptime data for ${Object.keys(this.uptimeData).length} models`);
        } catch (error) {
            errorLog("Error saving uptime data:", error);
        }
    }

    /**
     * Record an uptime check for a model
     * @param {string} modelName - Name of the model
     * @param {boolean} isUp - Whether the model is up
     * @param {string} type - Type of model ('text' or 'image')
     */
    recordCheck(modelName, isUp, type = "text") {
        if (!this.uptimeData[modelName]) {
            this.uptimeData[modelName] = {
                history: [],
                lastCheck: null,
                currentStatus: "unknown",
                type
            };
        }

        const timestamp = Date.now();
        const uptimeEntry = {
            timestamp,
            status: isUp ? "up" : "down"
        };

        this.uptimeData[modelName].history.push(uptimeEntry);
        this.uptimeData[modelName].lastCheck = timestamp;
        this.uptimeData[modelName].currentStatus = isUp ? "online" : "offline";
        this.uptimeData[modelName].type = type;

        // Keep only the last N entries
        if (this.uptimeData[modelName].history.length > this.historyLength) {
            this.uptimeData[modelName].history = this.uptimeData[modelName].history.slice(-this.historyLength);
        }

        log(`Recorded check for ${modelName}: ${isUp ? 'up' : 'down'}`);
    }

    /**
     * Get uptime data for a specific model
     * @param {string} modelName - Name of the model
     */
    getModelUptime(modelName) {
        return this.uptimeData[modelName] || null;
    }

    /**
     * Get uptime data for all models
     */
    getAllUptime() {
        return this.uptimeData;
    }

    /**
     * Get uptime percentage for a model
     * @param {string} modelName - Name of the model
     * @param {number} hours - Number of hours to calculate percentage for (default: 24)
     */
    getUptimePercentage(modelName, hours = 24) {
        const data = this.uptimeData[modelName];
        if (!data || data.history.length === 0) {
            return null;
        }

        // Calculate how many entries to look at based on hours
        // With 5-min intervals, 12 entries per hour
        const entriesToCheck = Math.min(hours * 12, data.history.length);
        const recentHistory = data.history.slice(-entriesToCheck);

        const upCount = recentHistory.filter(entry => entry.status === "up").length;
        return Math.round((upCount / recentHistory.length) * 100);
    }

    /**
     * Clean up old data (older than 24 hours)
     */
    cleanupOldData() {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
        let cleaned = 0;

        for (const modelName in this.uptimeData) {
            const data = this.uptimeData[modelName];
            const oldLength = data.history.length;
            data.history = data.history.filter(entry => entry.timestamp > cutoffTime);
            
            if (data.history.length < oldLength) {
                cleaned += oldLength - data.history.length;
            }

            // Remove models with no recent data
            if (data.history.length === 0 && data.lastCheck < cutoffTime) {
                delete this.uptimeData[modelName];
            }
        }

        if (cleaned > 0) {
            log(`Cleaned up ${cleaned} old uptime entries`);
        }
    }
}

// Export singleton instance
export const uptimeMonitor = new UptimeMonitor();
