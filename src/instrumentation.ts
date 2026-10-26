// Runs once when the server starts. The Node-only work lives in a separate
// module so it is never compiled for the Edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateOnStartup } = await import("./instrumentation-node");
    await migrateOnStartup();
  }
}
