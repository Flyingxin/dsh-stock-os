/**
 * Panel data plane for the stock-os Client page.
 * Prefix: /stock-os
 *   GET  /api/health
 *   GET  /api/list
 *   GET  /api/dossier?symbol=
 *   GET  /api/status?symbol=
 *   GET  /api/next?symbol=&price=
 *   GET  /api/journal?symbol=&limit=
 *   GET  /api/playbooks
 *   GET  /api/playbook?stage=
 *   GET  /api/guards?symbol=&price=
 *   GET  /api/data?symbol=
 *   GET  /api/notes/toc?part=
 *   GET  /api/notes/search?q=&limit=
 *   POST /api/init
 *   POST /api/journal
 *   POST /api/charts
 *   GET  /  or /fin-notes.html   static lab pages (财报笔记等)
 *   GET  /reports/<file>         generated notes / chart pages
 */
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { checkDataset, readDataset } from './dataset.js'
import { emit as emitNotes, loadIndex, parts as noteParts, search as searchNotes } from './notes.js'
import { buildChartsHtml } from './charts.js'
import { STAGE_PROMPTS, USAGE_HINT } from './prompts.js'

const BASE = '/stock-os'
const PLAYBOOK_STAGES = [
  'conductor', 'research', 'plan', 'entry', 'add', 'hold', 'reduce', 'exit', 'review',
]
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

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

/** Only serve files under labDir; reject .. and dotted segments. */
function safeLabFile(labDir, rel) {
  if (!labDir) return null
  const parts = String(rel || '').replace(/^\/+/, '').split(/[/\\]/)
  if (!parts.length || parts.some((p) => !p || p.startsWith('.'))) return null
  let base
  try { base = realpathSync(labDir) } catch { return null }
  const file = path.normalize(path.join(base, ...parts))
  const under = (child, root) => {
    const a = child.toLowerCase()
    const b = root.toLowerCase()
    return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep)
  }
  if (!under(file, base)) return null
  if (!existsSync(file)) return null
  const real = realpathSync(file)
  if (!under(real, base) || !statSync(real).isFile()) return null
  return real
}

function serveFile(req, res, file) {
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': statSync(file).size,
    'cache-control': 'no-cache',
  })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).pipe(res)
}

/** webServer may pass either `/stock-os/...` or already-stripped `/...`. */
function routeFromReq(reqUrl) {
  const url = new URL(reqUrl, 'http://x')
  let pathname = decodeURIComponent(url.pathname || '/')
  if (pathname === BASE || pathname.startsWith(BASE + '/')) {
    pathname = pathname.slice(BASE.length) || '/'
  }
  if (!pathname.startsWith('/')) pathname = '/' + pathname
  return { url, route: pathname }
}

export function registerApi(ctx, { dir, handle, resolveGuidance, playbooksDir, labDir, reportsDir, notesFile }) {
  const NOTES = notesFile || (labDir ? path.join(labDir, 'fin-notes.html') : null)
  // webServer.register() 只返回解绑函数，不自动挂到插件生命周期上。
  // 交给 ctx.effect 才能保证插件卸载时路由被摘掉；否则重载会撞
  // "webserver: duplicate prefix route"，插件永久变成“只能重启才能重载”。
  const register = () => ctx.webServer.register({
    kind: 'prefix',
    path: BASE,
    async handler(req, res) {
      try {
        const rejection = requestRejection(ctx, req)
        if (typeof rejection === 'number') return json(res, rejection, { error: '未授权' })

        const { url, route } = routeFromReq(req.url)

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

        if (route === '/api/status' && req.method === 'GET') {
          const symbol = url.searchParams.get('symbol') || ''
          if (!symbol) return json(res, 400, { error: '缺少 symbol' })
          if (typeof resolveGuidance !== 'function') {
            return json(res, 503, { error: 'guidance 未绑定' })
          }
          try {
            const result = await resolveGuidance(dir, symbol, { mode: 'status' })
            return json(res, 200, result)
          } catch (error) {
            return json(res, 404, { error: error.message })
          }
        }

        if (route === '/api/next' && req.method === 'GET') {
          const symbol = url.searchParams.get('symbol') || ''
          const price = url.searchParams.get('price')
          if (!symbol) return json(res, 400, { error: '缺少 symbol' })
          if (typeof resolveGuidance !== 'function') {
            return json(res, 503, { error: 'guidance 未绑定' })
          }
          try {
            const result = await resolveGuidance(dir, symbol, {
              mode: 'next',
              price: price == null || price === '' ? undefined : Number(price),
            })
            if (result.next && result.next.chatPrompt) {
              result.chatPrompt = result.next.chatPrompt
            }
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

        if (route === '/api/data' && req.method === 'GET') {
          const symbol = (url.searchParams.get('symbol') || '').toUpperCase()
          if (!symbol) return json(res, 400, { error: '缺少 symbol' })
          const dataset = await readDataset(dir, symbol)
          if (!dataset) return json(res, 200, { ok: false, found: false, symbol })
          const report = checkDataset(dataset)
          const full = url.searchParams.get('full') === '1'
          return json(res, 200, { ok: report.ok, found: true, report, dataset: full ? dataset : undefined })
        }

        if (route === '/api/notes/toc' && req.method === 'GET') {
          if (!NOTES) return json(res, 503, { error: '笔记未绑定' })
          const index = await loadIndex(NOTES)
          const part = url.searchParams.get('part')
          const parts = noteParts(index)
          if (part) {
            const hit = parts.find(p => String(p.part) === String(part))
            if (!hit) return json(res, 404, { error: `没有第 ${part} 部分` })
            return json(res, 200, { ok: true, part: hit.part, name: hit.name, rows: hit.sections })
          }
          return json(res, 200, {
            ok: true,
            count: index.sections.length,
            rows: parts.map(p => ({
              part: p.part, name: p.name,
              from: p.sections[0].no, to: p.sections[p.sections.length - 1].no,
              sections: p.sections.length,
            })),
          })
        }

        if (route === '/api/notes/search' && req.method === 'GET') {
          if (!NOTES) return json(res, 503, { error: '笔记未绑定' })
          const q = url.searchParams.get('q') || url.searchParams.get('query') || ''
          if (!q.trim()) return json(res, 400, { error: '缺少 q' })
          const index = await loadIndex(NOTES)
          const rows = searchNotes(index, q, Number(url.searchParams.get('limit')) || 5)
          return json(res, 200, { ok: true, count: rows.length, rows })
        }

        if (route === '/api/charts' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req)
            const symbol = String(body.symbol || '').toUpperCase()
            if (!symbol) return json(res, 400, { error: '缺少 symbol' })
            const dataset = await readDataset(dir, symbol)
            if (!dataset) return json(res, 404, { error: `${symbol} 没有近五年数据` })
            const report = checkDataset(dataset)
            if (!report.ok && !body.force) {
              return json(res, 409, { ok: false, error: '数据不完整', report })
            }
            const html = buildChartsHtml(dataset)
            const target = path.join(reportsDir, `${symbol}-charts.html`)
            await fs.mkdir(reportsDir, { recursive: true })
            await fs.writeFile(target, html, 'utf8')
            return json(res, 200, {
              ok: true,
              figures: (html.match(/class="chart"/g) || []).length,
              url: `/stock-os/reports/${symbol}-charts.html`,
              report,
            })
          } catch (error) {
            return json(res, error.status || 400, { ok: false, error: error.message })
          }
        }

        if (route === '/api/report' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req)
            const result = await handle('report', body, dir)
            return json(res, 200, result)
          } catch (error) {
            return json(res, error.status || 400, { ok: false, error: error.message })
          }
        }

        if (route === '/api/delete' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req)
            const result = await handle('delete', body, dir)
            return json(res, 200, result)
          } catch (error) {
            return json(res, error.status || 400, { ok: false, error: error.message })
          }
        }

        if (route === '/api/prompts' && req.method === 'GET') {
          return json(res, 200, { ok: true, stages: STAGE_PROMPTS, hint: USAGE_HINT })
        }

        if (route.startsWith('/reports/') && (req.method === 'GET' || req.method === 'HEAD')) {
          const file = safeLabFile(reportsDir, route.slice('/reports/'.length))
          if (!file) return json(res, 404, { error: 'not found' })
          return serveFile(req, res, file)
        }

        if (route.startsWith('/api/')) return json(res, 404, { error: 'not found' })

        // Static lab pages (财报笔记等)
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          return json(res, 405, { error: 'method' })
        }
        let rel = (!route || route === '/') ? 'fin-notes.html' : route.replace(/^\/+/, '')
        // Accept short aliases from the Client tab.
        if (rel === 'notes' || rel === 'notes.html' || rel === '财报笔记.html') rel = 'fin-notes.html'
        const file = safeLabFile(labDir, rel)
        if (!file) {
          return json(res, 404, {
            error: 'not found',
            route,
            rel,
            labDir: labDir || null,
          })
        }
        return serveFile(req, res, file)
      } catch (error) {
        return json(res, 500, { error: error.message || String(error) })
      }
    },
  })
  return typeof ctx.effect === 'function' ? ctx.effect(register) : register()
}
