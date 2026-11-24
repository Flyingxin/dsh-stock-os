/**
 * Panel data plane for the stock-os Client page.
 * Prefix: /stock-os
 *   GET  /api/health
 *   GET  /api/list
 *   GET  /api/dossier?symbol=
 *   GET  /api/journal?symbol=&limit=
 *   GET  /api/playbooks
 *   GET  /api/playbook?stage=
 *   GET  /api/guards?symbol=&price=
 *   POST /api/init
 *   POST /api/journal
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const BASE = '/stock-os'
const PLAYBOOK_STAGES = [
  'conductor', 'research', 'plan', 'entry', 'add', 'hold', 'reduce', 'exit', 'review',
]

function json(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(value))
}

function requestRejection(ctx, req) {
  const connection = ctx.get && ctx.get('connection')
  if (typeof connection?.requestRejection !== 'function') return false
  return connection.requestRejection({ headers: req.headers })
}

function readJsonBody(req, max = 16 * 1024) {
  return new Promise((resolve, reject) => {
    const origin = req.headers.origin
    if (req.method !== 'POST') return reject(Object.assign(new Error('method'), { status: 405 }))
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) {
      return reject(Object.assign(new Error('type'), { status: 415 }))
    }
    if (origin && origin.replace(/^https?:\/\//, '') !== req.headers.host) {
      return reject(Object.assign(new Error('origin'), { status: 403 }))
    }
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > max) req.destroy()
      else chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (error) {
        reject(Object.assign(error, { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

async function readJournal(dir, { symbol = null, limit = 80 } = {}) {
  const file = path.join(dir, 'journal.jsonl')
  let text = ''
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return []
    throw error
  }
  const rows = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const row = JSON.parse(line)
      if (symbol && row.symbol && String(row.symbol).toUpperCase() !== symbol) continue
      rows.push(row)
    } catch {
      // skip broken lines
    }
  }
  return rows.slice(-Math.max(1, Math.min(500, Number(limit) || 80))).reverse()
}

async function listPlaybooks(playbooksDir) {
  const out = []
  for (const stage of PLAYBOOK_STAGES) {
    const file = path.join(playbooksDir, stage + '.md')
    try {
      const text = await fs.readFile(file, 'utf8')
      const title = (text.match(/^#\s+(.+)$/m) || [])[1] || stage
      out.push({ stage, title, chars: text.length })
    } catch {
      // missing stage file
    }
  }
  return out
}

export function registerApi(ctx, { dir, handle, playbooksDir }) {
  return ctx.webServer.register({
    kind: 'prefix',
    path: BASE,
    async handler(req, res) {
      try {
        const rejection = requestRejection(ctx, req)
        if (typeof rejection === 'number') return json(res, rejection, { error: '未授权' })

        const url = new URL(req.url, 'http://x')
        const route = decodeURIComponent(url.pathname.slice(BASE.length)) || '/'

        if (route === '/api/health' && req.method === 'GET') {
          return json(res, 200, { ok: true, dir })
        }

        if (route === '/api/list' && req.method === 'GET') {
          const result = await handle('list', {}, dir)
          const rows = result.rows || []
          const holding = rows.filter((r) => r.qty > 0).length
          const byStage = {}
          for (const r of rows) byStage[r.stage] = (byStage[r.stage] || 0) + 1
          return json(res, 200, {
            ok: true,
            dir: result.dir,
            count: result.count,
            rows,
            stats: { holding, byStage },
          })
        }

        if (route === '/api/dossier' && req.method === 'GET') {
          const symbol = url.searchParams.get('symbol') || ''
          if (!symbol) return json(res, 400, { error: '缺少 symbol' })
          try {
            const result = await handle('get', { symbol }, dir)
            return json(res, 200, result)
          } catch (error) {
            return json(res, 404, { error: error.message })
          }
        }

        if (route === '/api/journal' && req.method === 'GET') {
          const symbol = url.searchParams.get('symbol')
          const limit = url.searchParams.get('limit')
          const rows = await readJournal(dir, {
            symbol: symbol ? String(symbol).toUpperCase() : null,
            limit,
          })
          return json(res, 200, { ok: true, count: rows.length, rows })
        }

        if (route === '/api/playbooks' && req.method === 'GET') {
          return json(res, 200, { ok: true, stages: await listPlaybooks(playbooksDir) })
        }

        if (route === '/api/playbook' && req.method === 'GET') {
          const stage = url.searchParams.get('stage') || ''
          if (!PLAYBOOK_STAGES.includes(stage)) {
            return json(res, 400, { error: `stage 只能是 ${PLAYBOOK_STAGES.join(' / ')}` })
          }
          try {
            const text = await fs.readFile(path.join(playbooksDir, stage + '.md'), 'utf8')
            return json(res, 200, { ok: true, stage, text })
          } catch {
            return json(res, 404, { error: `没有 ${stage} 的手册` })
          }
        }

        if (route === '/api/guards' && req.method === 'GET') {
          const symbol = url.searchParams.get('symbol') || ''
          const price = url.searchParams.get('price')
          if (!symbol) return json(res, 400, { error: '缺少 symbol' })
          try {
            const result = await handle('guards', {
              symbol,
              price: price == null || price === '' ? undefined : Number(price),
            }, dir)
            return json(res, 200, result)
          } catch (error) {
            return json(res, 404, { error: error.message })
          }
        }

        if (route === '/api/init' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req)
            const result = await handle('init', body, dir)
            return json(res, 200, result)
          } catch (error) {
            return json(res, error.status || 400, { ok: false, error: error.message })
          }
        }

        if (route === '/api/journal' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req)
            const result = await handle('journal', body, dir)
            return json(res, 200, result)
          } catch (error) {
            return json(res, error.status || 400, { ok: false, error: error.message })
          }
        }

        if (route.startsWith('/api/')) return json(res, 404, { error: 'not found' })
        return json(res, 404, { error: 'not found' })
      } catch (error) {
        return json(res, 500, { error: error.message || String(error) })
      }
    },
  })
}
