const API_URL = process.env.NEXT_PUBLIC_API_URL

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `API error ${res.status}` }))
    throw new Error(body.error || `API error ${res.status}`)
  }
  return res.json()
}

export async function serverFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${process.env.API_URL}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `API error ${res.status}` }))
    throw new Error(body.error || `API error ${res.status}`)
  }
  return res.json()
}
