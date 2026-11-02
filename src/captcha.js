// Invisible reCAPTCHA v3 for sign-up, sign-in and password-reset requests. Off (and no Google script loaded) until VITE_RECAPTCHA_SITE_KEY is set.
// The server checks the token in api/_auth.js; this returns the header Better Auth looks for.
const key = import.meta.env.VITE_RECAPTCHA_SITE_KEY
let loading
const load = () => (loading ||= new Promise((ok, no) => {
  const s = document.createElement('script')
  s.src = `https://www.google.com/recaptcha/api.js?render=${key}`; s.onload = ok; s.onerror = () => { loading = null; no(new Error('captcha blocked')) }
  document.head.append(s)
}))
export async function captchaOptions() { // pass as `fetchOptions`; a token works once, so ask again for every request
  if (!key) return {}
  try {
    await load(); await new Promise((r) => grecaptcha.ready(r))
    return { headers: { 'x-captcha-response': await grecaptcha.execute(key, { action: 'auth' }) } }
  } catch { return {} } // the server then answers "missing captcha", which is shown like any other error
}
