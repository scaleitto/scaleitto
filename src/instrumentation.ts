// Runs once when the server starts. The Node-only work lives in a separate
// module so it is never compiled for the Edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateOnStartup } = await import("./instrumentation-node");
    await migrateOnStartup();
  }
}

// Server errors are saved to the database so the platform admin can read them.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routeType: string },
) {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logRequestError } = await import("./instrumentation-node");
    await logRequestError(error, request, context);
  }
}
