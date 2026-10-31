// Local stand-in for the Anthropic API: answers fetch() to /v1/messages through this terminal's `claude` login, so no key is needed.
// Prompts can hold text from web pages and files, so the CLI runs with no tools, no MCP servers and no settings, in an empty folder.
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const API = 'https://api.anthropic.com/'
const cwd = mkdtempSync(join(tmpdir(), 'desker-ai-'))
// Set when the server is started from inside a Claude Code session; the child is its own, separate run.
const SESSION_VARS = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_SESSION_ATTENDED', 'CLAUDE_PID', 'CLAUDE_EFFORT']

const env = { ...process.env, MAX_THINKING_TOKENS: '0' } // the app's API calls don't use thinking either
for (const k of SESSION_VARS) delete env[k]

const textOf = (content) => (typeof content === 'string' ? content : content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'))

// The CLI takes one new message, so earlier turns go in front of it as text.
function toContent(messages) {
  const last = messages.at(-1).content
  const blocks = typeof last === 'string' ? [{ type: 'text', text: last }] : last
  if (messages.length === 1) return blocks
  const history = messages.slice(0, -1).map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${textOf(m.content)}`).join('\n')
  return [{ type: 'text', text: `The conversation so far:\n${history}\n\nThe user's latest message:` }, ...blocks]
}

function runClaude({ model, system, messages }, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['--print', '--model', model, '--system-prompt', system || 'You are a helpful assistant.',
      '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence',
      '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'], { cwd, env, signal, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', errors = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { errors += d })
    child.stdin.on('error', () => {}) // the exit below reports it
    child.on('error', reject)
    child.on('close', (code) => {
      const result = out.trim().split('\n').map((l) => { try { return JSON.parse(l) } catch { return null } }).find((e) => e?.type === 'result')
      if (!result || result.is_error) return reject(new Error(result?.result || errors.trim() || `claude exited with code ${code}`))
      resolve(result)
    })
    child.stdin.end(`${JSON.stringify({ type: 'user', message: { role: 'user', content: toContent(messages) } })}\n`)
  })
}

const realFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  if (!String(input?.url ?? input).startsWith(API)) return realFetch(input, init)
  const body = JSON.parse(init.body)
  try {
    const { result, usage } = await runClaude(body, init.signal)
    return Response.json({ model: body.model, content: [{ type: 'text', text: result }], usage })
  } catch (err) {
    if (err.name === 'AbortError') throw err // a timeout, as the real fetch reports it
    console.error('[claude]', err.message)
    return Response.json({ error: { message: err.message } }, { status: 502 })
  }
}
