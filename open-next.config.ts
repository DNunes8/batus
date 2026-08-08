import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config: no persistent ISR cache yet (the homepage's 1h ISR just
// regenerates per-isolate, which is fine at our traffic). R2 cache can be
// added later if ever needed.
export default defineCloudflareConfig();
