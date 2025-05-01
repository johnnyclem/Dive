export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  // Forward to the Vite dev proxy (or production relative URL)
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
  });
  return response;
} 