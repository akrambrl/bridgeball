interface RetryOptions<T> {
  attempts?: number;
  delayMs?: number;
  shouldRetry?: (result: T) => boolean;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions<T> = {},
): Promise<T> {
  const { attempts = 3, delayMs = 300, shouldRetry } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation();

      if (!shouldRetry || !shouldRetry(result)) {
        return result;
      }

      lastError = new Error("Retry requested");
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await wait(delayMs * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Operation failed after retries");
}