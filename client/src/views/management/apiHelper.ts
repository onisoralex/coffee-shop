// Thin wrapper around fetch that injects the management JWT and throws on non-2xx.
// On 401, clears the stored token and redirects to the management login page.
export async function apiFetch(token: string, url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  if (res.status === 401) {
    localStorage.removeItem('management_token')
    window.location.href = '/management'
  }
  return res
}
