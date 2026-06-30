export async function register() {
    if (process.env.NEXT_PHASE === "phase-production-build") {
        console.log("Skipping worker initialization during build phase.");
        return;
    }
    
    if (process.env.NEXT_RUNTIME === "nodejs") {
        // Run only on Node.js runtime, not Edge
        const { initializeWorker } = await import("./lib/queue/worker");
        initializeWorker();
    }
}

