import { ISensorDriver } from "../types.js";

/**
 * Driver for a virtual "image analyzer" sensor (like AI Snow Depth).
 * This sensor does not perform periodic hardware reads. Its value is updated
 * on-demand by external commands (e.g., 'ANALYZE_SNOW_DEPTH').
 *
 * This driver exists to prevent the agent from crashing when trying to load
 * a non-existent driver file for virtual sensors.
 */
export default class ImageAnalyzerDriver implements ISensorDriver {
    /**
     * This is a placeholder read method. Virtual sensors are not read periodically.
     * Their values are pushed by other processes (like command executions).
     * @param config - Sensor-specific configuration (not used here).
     * @returns Always returns null as there is no value to read in a cycle.
     */
    public read(config: any): Promise<Record<string, any> | null> {
        // This log can be enabled for debugging but is commented out to avoid spamming.
        // console.log(`     -> INFO: 'image_analyzer' is a virtual sensor and does not perform periodic reads.`);
        return Promise.resolve(null);
    }
}
