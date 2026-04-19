const DEFAULT_UPSTREAM_TIMEOUT_MS = 8_000;

const createUpstreamError = (message, status, extra = {}) => {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
};

export const fetchJsonWithTimeout = async ({
  url,
  headers = {},
  timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
  fetchImpl = fetch,
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('timeout'));
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw createUpstreamError(`Upstream API error: ${response.status}`, response.status, {
        body: errorBody,
      });
    }

    return response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createUpstreamError('Upstream request timed out', 504);
    }

    if (typeof error?.status === 'number') {
      throw error;
    }

    throw createUpstreamError('Upstream request failed', 502, {
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export { DEFAULT_UPSTREAM_TIMEOUT_MS };
