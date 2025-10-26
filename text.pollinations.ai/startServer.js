import debug from "debug";
import app from "./server.js";
import { uptimeMonitor } from "./uptimeMonitor.js";

const log = debug("pollinations:startup");

const port = process.env.PORT || 16385;

// Initialize uptime monitor
await uptimeMonitor.initialize();

app.listen(port, () => {
    log("Server is running on port %d", port);
    
    // Validate ENTER_TOKEN configuration
    if (!process.env.ENTER_TOKEN) {
        log('⚠️  ENTER_TOKEN not set - enter.pollinations.ai bypass disabled');
    }
    
    log("✅ Uptime monitor initialized");
});
