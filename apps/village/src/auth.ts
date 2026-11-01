import { createAuthClient } from 'better-auth/react'

export const API = import.meta.env.VITE_API_URL ?? 'http://desker.test:3000'
// The cookie lives on the shared parent domain; credentials: 'include' sends it to the Desker API (CORS: VILLAGE_ORIGINS there).
export const authClient = createAuthClient({ baseURL: API, fetchOptions: { credentials: 'include' } })

/** Send a signed-out visitor to desker.dev sign-in, then back here (Desker only honours *.desker.dev). */
export const signIn = () => location.replace(`${API}/login?redirect=${encodeURIComponent(location.href)}`)
