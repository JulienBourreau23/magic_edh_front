const TOKEN_KEY = "magic_edh_token"

/**
 * Jeton conservé en `localStorage`. Suffisant pour une application personnelle
 * sur le homelab ; si un jour elle devient multi-utilisateur ou exposée plus
 * largement, c'est le premier point à revoir (cookie httpOnly).
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
