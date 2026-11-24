/**
 * The interactive notes (132 sections, 8 chapters) as a tool.
 *
 * Two jobs:
 *   search() — find the section that answers a question, with the excerpt, so
 *              a research note can cite "第 118 节" instead of paraphrasing air.
 *   emit()   — hand the reader the full single-file HTML (optionally stamped
 *              with the company being researched, optionally deep-linked).
 *
 * The HTML is the authored artefact: we parse it, we never regenerate it.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&middot;': '·', '&mdash;': '—',
}

export function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, m => ENTITIES[m.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

let cache = { file: null, mtime: 0, index: null }

/** Parse `<section class="sec" id="sec-N" data-part="P">` blocks out of the HTML. */
export async function loadIndex(file) {
  let stat
  try {
    stat = await fs.stat(file)
  } catch {
    throw new Error(`找不到笔记文件：${file}`)
  }
  if (cache.file === file && cache.mtime === stat.mtimeMs && cache.index) return cache.index

  const html = await fs.readFile(file, 'utf8')
  const sections = []
  const re = /<section[^>]*class="sec"[^>]*id="sec-(\d+)"[^>]*data-part="(\d+)"[^>]*>([\s\S]*?)<\/section>/g
  let m
  while ((m = re.exec(html))) {
    const no = Number(m[1])
    const part = Number(m[2])
    const body = m[3]
    const h1 = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
    const title = h1 ? stripHtml(h1[1]) : `第 ${no} 节`
    const crumb = body.match(/<div class="crumb"[^>]*>([\s\S]*?)<\/div>/)
    const crumbText = crumb ? stripHtml(crumb[1]) : ''
    const partName = (crumbText.split('·')[0] || '').trim()
    const text = stripHtml(body.replace(h1 ? h1[0] : '', '').replace(crumb ? crumb[0] : '', ''))
    sections.push({ no, part, partName, title, text })
  }
  if (!sections.length) throw new Error(`笔记文件里没有解析出任何 section：${file}`)
  sections.sort((a, b) => a.no - b.no)
  const index = { file, sections, byNo: new Map(sections.map(s => [s.no, s])) }
  cache = { file, mtime: stat.mtimeMs, index }
  return index
}

export function parts(index) {
  const out = new Map()
  for (const s of index.sections) {
    if (!out.has(s.part)) out.set(s.part, { part: s.part, name: s.partName || `第 ${s.part} 部分`, sections: [] })
    out.get(s.part).sections.push({ no: s.no, title: s.title })
  }
  return [...out.values()].sort((a, b) => a.part - b.part)
}

function snippet(text, term, width = 90) {
  const at = text.indexOf(term)
  if (at < 0) return text.slice(0, width) + (text.length > width ? '…' : '')
  const start = Math.max(0, at - Math.floor(width / 2))
  const end = Math.min(text.length, start + width)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

/** Rank sections by term frequency; Chinese has no word breaks, so match substrings. */
export function search(index, query, limit = 5) {
  const terms = String(query || '').split(/[\s,，、;；]+/).map(t => t.trim()).filter(t => t.length >= 1)
  if (!terms.length) throw new Error('query 不能为空')
  const hits = []
  for (const s of index.sections) {
    let score = 0
    let first = null
    for (const term of terms) {
      const inTitle = s.title.includes(term)
      const bodyCount = s.text.split(term).length - 1
      if (inTitle) score += 12
      if (bodyCount) score += Math.min(bodyCount, 6)
      if (!first && (inTitle || bodyCount)) first = term
    }
    if (score > 0) hits.push({ score, section: s, term: first })
  }
  hits.sort((a, b) => b.score - a.score || a.section.no - b.section.no)
  return hits.slice(0, Math.max(1, Math.min(20, limit))).map(h => ({
    no: h.section.no,
    part: h.section.partName || `第 ${h.section.part} 部分`,
    title: h.section.title,
    score: h.score,
    excerpt: snippet(h.section.text, h.term),
  }))
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

/**
 * Copy the notes to `target` (default: <dataDir>/reports/), optionally with a
 * "本次调研对象" banner and a deep link. Returns the written path and URL.
 */
export async function emit(index, { target, symbol, name, sourcedAt, section }) {
  const html = await fs.readFile(index.file, 'utf8')
  const no = section == null ? null : Number(section)
  if (no != null && !index.byNo.has(no)) {
    throw new Error(`没有第 ${no} 节；可选范围 ${index.sections[0].no}–${index.sections[index.sections.length - 1].no}`)
  }
  let out = html
  if (symbol) {
    const stamp = [symbol, name].filter(Boolean).join(' ')
    const meta = [stamp, sourcedAt ? `数据截止 ${sourcedAt}` : null].filter(Boolean).join(' · ')
    const banner = `<div id="stock-os-stamp" style="position:sticky;top:0;z-index:99;background:#16181d;color:#fff;`
      + `font:12.5px/1.6 -apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;padding:7px 14px;`
      + `display:flex;gap:14px;align-items:center">`
      + `<b style="font-weight:600">本次调研：${escapeHtml(meta)}</b>`
      + `<span style="opacity:.7">笔记是判断依据；结论请写进 stock_os verdict，并附数据出处</span>`
      + `</div>`
    out = out.replace(/<body([^>]*)>/i, `<body$1>${banner}`)
  }
  const file = path.resolve(target)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, out, 'utf8')
  return {
    path: file,
    bytes: Buffer.byteLength(out, 'utf8'),
    url: '/stock-os/notes' + (no != null ? `#sec-${no}` : ''),
    section: no,
  }
}
