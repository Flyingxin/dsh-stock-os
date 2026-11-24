/**
 * stock-os — a decision ledger for equity positions.
 *
 * The plugin deliberately does not forecast prices or emit buy/sell signals.
 * It enforces the one thing a human cannot enforce on themselves: a written
 * plan exists before the trade, every action leaves a record, and a rule
 * cannot be quietly rewritten after the fact.
 *
 * Data lives in a plain directory of JSON files so it can be read, diffed and
 * backed up with ordinary tools:
 *   <dataDir>/<symbol>.json    one dossier per company (verdict, constitution,
 *                              position, drawdown plan)
 *   <dataDir>/journal.jsonl    append-only action log, one JSON object per line
 */
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerApi } from './lib/api.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const STAGES = ['idea', 'research', 'plan', 'open', 'hold', 'closed']
const TRANSITIONS = {
  idea: ['research', 'closed'],
  research: ['plan', 'closed'],
  plan: ['open', 'research', 'closed'],
  open: ['hold', 'closed'],
  hold: ['closed'],
  closed: [],
}
const VERDICTS = ['pass', 'watch', 'fail', 'suspect', 'na']
const TRADE_ACTIONS = ['open', 'add', 'reduce', 'close']
const REQUIRED_CONSTITUTION = [
  'maxPositionPct', 'tranches', 'firstTranchePct', 'stopLossPct',
  'maxDrawdownPct', 'takeProfitPct', 'addRules', 'reduceRules',
  'exitSignals', 'invalidations', 'reviewCadenceDays',
]

const now = () => new Date().toISOString()
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d

function dataDir(config) {
  const dir = (config && config.dataDir) || path.join(os.homedir(), '.stock-os')
  return path.resolve(dir)
}
const dossierPath = (dir, symbol) => path.join(dir, symbol + '.json')
const journalPath = dir => path.join(dir, 'journal.jsonl')

function normalizeSymbol(raw) {
  const s = String(raw || '').trim().toUpperCase()
  if (!/^[0-9A-Z]{5,9}(\.[A-Z]{2,4})?$/.test(s)) {
    throw new Error(`股票代码格式异常："${raw}"。示例：600519.SH / 300750.SZ / 00700.HK`)
  }
  return s
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback
    throw new Error(`读取 ${file} 失败：${error.message}`)
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  await fs.rename(tmp, file)
}

async function appendJournal(dir, record) {
  await fs.mkdir(dir, { recursive: true })
  await fs.appendFile(journalPath(dir), JSON.stringify(record) + '\n', 'utf8')
}

async function loadDossier(dir, symbol) {
  const dossier = await readJson(dossierPath(dir, symbol), undefined)
  if (!dossier) throw new Error(`没有 ${symbol} 的档案。先执行 stock_os action=init。`)
  return dossier
}

function summarise(dossier) {
  const p = dossier.position || { qty: 0, avgCost: 0, openedAt: null }
  const c = dossier.constitution || null
  return {
    symbol: dossier.symbol,
    name: dossier.name || null,
    stage: dossier.stage,
    verdict: dossier.verdict ? dossier.verdict.status : null,
    holding: p.qty > 0,
    qty: p.qty || 0,
    avgCost: p.avgCost || 0,
    costValue: round((p.qty || 0) * (p.avgCost || 0)),
    maxPositionPct: c ? c.maxPositionPct : null,
    stopLossPct: c ? c.stopLossPct : null,
    reviewDueAt: (dossier.plans && dossier.plans.reviewDueAt) || null,
    updatedAt: dossier.updatedAt,
  }
}

/** Structural rules. Anything here blocks the write unless the caller forces it. */
function checkTrade(dossier, action, args) {
  const violations = []
  const c = dossier.constitution
  const p = dossier.position || { qty: 0, avgCost: 0 }
  const qty = Number(args.qty)
  const price = Number(args.price)
  if (!(qty > 0)) violations.push('数量必须大于 0')
  if (!(price > 0)) violations.push('价格必须大于 0')
  if (!c) {
    violations.push('没有策略宪法：任何买卖前必须先写 plan（仓位上限、分批、止损、回撤预案）')
    return violations
  }
  if (action === 'open') {
    if (!['plan', 'open'].includes(dossier.stage)) violations.push(`当前阶段 ${dossier.stage}，建仓只能在 plan 阶段`)
    if (!dossier.verdict || !['pass', 'watch'].includes(dossier.verdict.status)) {
      violations.push(`买前结论是 ${dossier.verdict ? dossier.verdict.status : '空'}，只有 pass 或 watch 允许建仓`)
    }
    if (!dossier.plans || !dossier.plans.drawdownPlan) violations.push('没有回撤预案：建仓前必须写"跌多少算我错了、那时怎么办"')
    const capital = Number(args.capital || dossier.account && dossier.account.capital || 0)
    if (capital > 0 && qty * price > capital * c.maxPositionPct / 100 * 1.001) {
      violations.push(`首笔 ${round(qty * price)} 元超过仓位上限 ${c.maxPositionPct}% × ${round(capital)} 元`)
    }
    if (capital > 0 && qty * price > capital * c.firstTranchePct / 100 * 1.001) {
      violations.push(`首笔 ${round(qty * price)} 元超过单笔上限 ${c.firstTranchePct}%`)
    }
  }
  if (action === 'add') {
    if (dossier.stage !== 'hold') violations.push(`当前阶段 ${dossier.stage}，加仓只能在 hold 阶段`)
    if (price < p.avgCost && !args.force) {
      violations.push(`加仓价 ${price} 低于成本 ${p.avgCost}：这是在摊薄成本，不是加仓。确认要这么做就带 force 并写清理由`)
    }
    const capital = Number(args.capital || dossier.account && dossier.account.capital || 0)
    if (capital > 0 && (p.qty * p.avgCost + qty * price) > capital * c.maxPositionPct / 100 * 1.001) {
      violations.push(`加仓后成本超过仓位上限 ${c.maxPositionPct}%`)
    }
  }
  if (action === 'reduce' || action === 'close') {
    if (!['open', 'hold'].includes(dossier.stage)) violations.push(`当前阶段 ${dossier.stage}，减仓/清仓只能在持仓阶段`)
    if (qty > (p.qty || 0)) violations.push(`卖出 ${qty} 股多于持有 ${p.qty || 0} 股`)
    if (action === 'close' && qty !== (p.qty || 0)) violations.push('清仓的数量必须等于当前持仓')
  }
  if (args.force && !args.overrideReason) violations.push('强制跳过规则时必须写 overrideReason')
  return violations
}

function applyTrade(dossier, action, args) {
  const p = dossier.position || { qty: 0, avgCost: 0, openedAt: null }
  const qty = Number(args.qty)
  const price = Number(args.price)
  if (action === 'open' || action === 'add') {
    if (p.qty === 0) {
      p.openedAt = now()
      p.avgCost = price
      p.qty = qty
    } else {
      p.avgCost = round((p.qty * p.avgCost + qty * price) / (p.qty + qty), 4)
      p.qty = round(p.qty + qty, 4)
    }
    dossier.stage = 'hold'
  } else {
    p.qty = round(p.qty - qty, 4)
    if (p.qty <= 0) {
      p.qty = 0
      p.avgCost = 0
      dossier.stage = 'closed'
    }
  }
  dossier.position = p
  return p
}

function nextActions(dossier) {
  const out = []
  switch (dossier.stage) {
    case 'idea':
      out.push('写买前调研（playbook stage=research）：行业/商业模式/护城河/财务底稿/估值/内部人行为', '调研后 action=verdict 落结论，再 stage=research')
      break
    case 'research':
      out.push('把结论翻成规则（playbook stage=plan）：仓位上限、分批、止损止盈、回撤预案', '写好宪法后 stage=plan')
      break
    case 'plan':
      out.push('等信号，按宪法第一笔建仓（action=trade trade=open）', '建仓后 stage=hold 自动完成')
      break
    case 'open':
    case 'hold':
      out.push('按 reviewCadenceDays 设置盘后检查；触发止损/止盈/失效条件时先写理由再动手', '每次加减仓都要 trade 记录，理由写未来可验证的那一句')
      break
    case 'closed':
      out.push('写复盘（playbook stage=review）：按当时的信息重放一遍，哪些是可预见的、哪些是运气', '复盘结论回写到 constitution 或 invalidations 里')
      break
  }
  return out
}

async function handle(action, args, dir) {
  switch (action) {
    case 'init': {
      const symbol = normalizeSymbol(args.symbol)
      const existing = await readJson(dossierPath(dir, symbol), undefined)
      if (existing) return { ok: true, created: false, dossier: summarise(existing), message: '档案已存在' }
      const dossier = {
        schema: 1,
        symbol,
        name: args.name || null,
        stage: 'idea',
        createdAt: now(),
        updatedAt: now(),
        account: { capital: Number(args.capital) || 0 },
        verdict: null,
        constitution: null,
        position: { qty: 0, avgCost: 0, openedAt: null, tranches: [] },
        plans: null,
        notes: args.note || null,
      }
      await writeJson(dossierPath(dir, symbol), dossier)
      await appendJournal(dir, { ts: now(), symbol, action: 'init', stage: 'idea', reason: args.note || '建立档案' })
      return { ok: true, created: true, dossier: summarise(dossier), message: '档案已建立，下一步：买前调研' }
    }
    case 'get': {
      const dossier = await loadDossier(dir, normalizeSymbol(args.symbol))
      return {
        ok: true,
        dossier: summarise(dossier),
        verdict: dossier.verdict,
        constitution: dossier.constitution,
        plans: dossier.plans,
        nextActions: nextActions(dossier),
      }
    }
    case 'list': {
      let files = []
      try {
        files = (await fs.readdir(dir)).filter(f => f.endsWith('.json'))
      } catch (error) {
        if (!error || error.code !== 'ENOENT') throw error
      }
      const rows = []
      for (const f of files) {
        const d = await readJson(path.join(dir, f), undefined)
        if (d && d.symbol) rows.push(summarise(d))
      }
      rows.sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
      return { ok: true, dir, count: rows.length, rows }
    }
    case 'verdict': {
      const dossier = await loadDossier(dir, normalizeSymbol(args.symbol))
      if (!VERDICTS.includes(args.status)) throw new Error(`结论只能是 ${VERDICTS.join(' / ')}`)
      dossier.verdict = {
        status: args.status,
        summary: args.summary || null,
        hardStops: args.hardStops || [],
        anomalies: args.anomalies || [],
        sourcedAt: args.sourcedAt || null,
        at: now(),
      }
      // A written verdict means research happened; keep the stage honest
      // without forcing the caller through a no-op transition.
      if (dossier.stage === 'idea') dossier.stage = 'research'
      dossier.updatedAt = now()
      await writeJson(dossierPath(dir, dossier.symbol), dossier)
      await appendJournal(dir, { ts: now(), symbol: dossier.symbol, action: 'verdict', stage: dossier.stage, status: args.status, reason: args.summary || '' })
      return { ok: true, dossier: summarise(dossier), verdict: dossier.verdict }
    }
    case 'constitution': {
      const dossier = await loadDossier(dir, normalizeSymbol(args.symbol))
      const c = args.constitution || {}
      const missing = REQUIRED_CONSTITUTION.filter(k => c[k] === undefined || c[k] === null || c[k] === '')
      if (missing.length) throw new Error(`策略宪法缺字段：${missing.join(', ')}`)
      if (!Array.isArray(c.exitSignals) || c.exitSignals.length === 0) throw new Error('exitSignals 至少写一条')
      if (!Array.isArray(c.invalidations) || c.invalidations.length === 0) throw new Error('invalidations 至少写一条（什么情况下这笔投资的前提就不成立了）')
      dossier.constitution = { ...dossier.constitution, ...c, at: now() }
      dossier.updatedAt = now()
      await writeJson(dossierPath(dir, dossier.symbol), dossier)
      await appendJournal(dir, { ts: now(), symbol: dossier.symbol, action: 'constitution', stage: dossier.stage, reason: c.addRules || '写入策略宪法' })
      return { ok: true, dossier: summarise(dossier), constitution: dossier.constitution }
    }
    case 'plan': {
      const dossier = await loadDossier(dir, normalizeSymbol(args.symbol))
      dossier.plans = {
        drawdownPlan: args.drawdownPlan || null,
        reviewDueAt: args.reviewDueAt || null,
        missingData: args.missingData || [],
        at: now(),
      }
      dossier.updatedAt = now()
      await writeJson(dossierPath(dir, dossier.symbol), dossier)
      await appendJournal(dir, { ts: now(), symbol: dossier.symbol, action: 'plan', stage: dossier.stage, reason: args.drawdownPlan || '' })
      return { ok: true, plans: dossier.plans }
    }
    case 'stage': {
      const dossier = await loadDossier(dir, normalizeSymbol(args.symbol))
      const to = args.to
      if (!STAGES.includes(to)) throw new Error(`阶段只能是 ${STAGES.join(' / ')}`)
      if (!(TRANSITIONS[dossier.stage] || []).includes(to)) {
        throw new Error(`不能从 ${dossier.stage} 直接到 ${to}；允许：${(TRANSITIONS[dossier.stage] || []).join(' / ') || '无'}`)
      }
      if (to === 'plan' && !dossier.verdict) throw new Error('没有买前结论，不能进入 plan')
      if (to === 'plan' && !dossier.plans) throw new Error('没有回撤预案，不能进入 plan')
      if (to === 'open' && !dossier.constitution) throw new Error('没有策略宪法，不能进入 open')
      if (to === 'closed' && dossier.position && dossier.position.qty > 0) throw new Error('还有持仓，不能直接关闭；先 trade close')
      const from = dossier.stage
      dossier.stage = to
      dossier.updatedAt = now()
      await writeJson(dossierPath(dir, dossier.symbol), dossier)
      await appendJournal(dir, { ts: now(), symbol: dossier.symbol, action: 'stage', from, to, reason: args.reason || '' })
      return { ok: true, from, to, dossier: summarise(dossier), nextActions: nextActions(dossier) }
    }
    case 'trade': {
      const symbol = normalizeSymbol(args.symbol)
      const dossier = await loadDossier(dir, symbol)
      const trade = args.trade
      if (!TRADE_ACTIONS.includes(trade)) throw new Error(`trade 只能是 ${TRADE_ACTIONS.join(' / ')}`)
      if (!args.reason) throw new Error('必须写 reason：这一笔是为了什么，触发的是哪条规则')
      const violations = checkTrade(dossier, trade, args)
      if (violations.length && !args.force) {
        return { ok: false, blocked: true, violations, dossier: summarise(dossier) }
      }
      const before = { qty: dossier.position.qty, avgCost: dossier.position.avgCost }
      const position = applyTrade(dossier, trade, args)
      dossier.updatedAt = now()
      await writeJson(dossierPath(dir, symbol), dossier)
      await appendJournal(dir, {
        ts: now(),
        symbol,
        action: 'trade',
        trade,
        stage: dossier.stage,
        qty: Number(args.qty),
        price: Number(args.price),
        value: round(Number(args.qty) * Number(args.price)),
        reason: args.reason,
        triggerId: args.triggerId || null,
        overrides: args.force ? { violations, overrideReason: args.overrideReason } : null,
        before,
        after: { qty: position.qty, avgCost: position.avgCost },
        snapshot: args.snapshot || null,
      })
      return { ok: true, trade, position: summarise(dossier), message: '已记录。没有记录的动作等于没有发生。' }
    }
    case 'journal': {
      const text = args.text == null ? '' : String(args.text).trim()
      if (!text) return { ok: false, message: 'journal 需要 text：流水记的是理由，不是动作本身' }
      const symbol = args.symbol ? normalizeSymbol(args.symbol) : null
      await appendJournal(dir, {
        ts: now(),
        symbol,
        action: args.kind || 'note',
        reason: text,
        data: args.data || null,
      })
      return { ok: true, message: '已写入流水' }
    }
    case 'guards': {
      const dossier = await loadDossier(dir, normalizeSymbol(args.symbol))
      const violations = []
      const c = dossier.constitution
      if (!c) violations.push('没有策略宪法')
      if (!dossier.plans || !dossier.plans.drawdownPlan) violations.push('没有回撤预案')
      if (dossier.position && dossier.position.qty > 0) {
        if (c && Number(args.price) > 0 && dossier.position.avgCost > 0) {
          const pnlPct = (Number(args.price) / dossier.position.avgCost - 1) * 100
          if (pnlPct <= -Math.abs(c.stopLossPct)) violations.push(`已跌破止损线：现价 ${args.price}，成本 ${dossier.position.avgCost}，浮亏 ${round(pnlPct)}%，规则是 ${c.stopLossPct}%`)
          if (c.takeProfitPct && pnlPct >= Math.abs(c.takeProfitPct)) violations.push(`已触及止盈线：浮盈 ${round(pnlPct)}%，规则是 ${c.takeProfitPct}%`)
        }
        if (dossier.plans && dossier.plans.reviewDueAt && new Date(dossier.plans.reviewDueAt) < new Date()) {
          violations.push(`复盘已逾期：约定 ${dossier.plans.reviewDueAt}`)
        }
      }
      return { ok: violations.length === 0, violations, dossier: summarise(dossier) }
    }
    default:
      throw new Error(`未知 action：${action}`)
  }
}

const ACTION_SCHEMA = { type: 'string', required: true, enum: ['init', 'get', 'list', 'verdict', 'constitution', 'plan', 'stage', 'trade', 'journal', 'guards'], description: '要执行的动作' }

export const name = 'stock-os'
export const inject = ['tools', 'webServer']

export function apply(ctx, config = {}) {
  const dir = dataDir(config)

  registerApi(ctx, {
    dir,
    handle,
    playbooksDir: path.join(HERE, 'playbooks'),
    labDir: path.join(HERE, 'lab'),
  })

  ctx.tools.register({
    name: 'stock_os',
    description:
      '投资决策账本：每只股票一份档案，记录买前结论、策略宪法、仓位与每笔动作。'
      + ' 它不预测股价；它保证"先有规则再动手、每个动作留痕、规则不能被事后悄悄改掉"。',
    parameters: {
      action: ACTION_SCHEMA,
      symbol: { type: 'string', description: '股票代码，如 600519.SH / 300750.SZ / 00700.HK' },
      name: { type: 'string', description: 'init 时的公司名' },
      capital: { type: 'number', description: 'init 时的账户总资金，用于仓位上限校验' },
      note: { type: 'string', description: 'init 时的备注' },
      status: { type: 'string', enum: VERDICTS, description: 'verdict：pass/watch/fail/suspect/na' },
      summary: { type: 'string', description: 'verdict 时的一句话结论' },
      hardStops: { type: 'array', items: { type: 'string' }, description: 'verdict：触发的硬性排除条件' },
      anomalies: { type: 'array', items: { type: 'string' }, description: 'verdict：未排除但需跟踪的异常' },
      sourcedAt: { type: 'string', description: 'verdict：数据截止日（财报期/行情日期）' },
      constitution: { type: 'object', description: 'constitution：策略宪法，必填 maxPositionPct/tranches/firstTranchePct/stopLossPct/maxDrawdownPct/takeProfitPct/addRules/reduceRules/exitSignals/invalidations/reviewCadenceDays' },
      drawdownPlan: { type: 'string', description: 'plan：回撤预案（跌多少算错、那时怎么办）' },
      reviewDueAt: { type: 'string', description: 'plan：下次复盘日期 ISO' },
      missingData: { type: 'array', items: { type: 'string' }, description: 'plan：缺哪些数据、缺了怎么降级' },
      to: { type: 'string', enum: STAGES, description: 'stage：目标阶段' },
      reason: { type: 'string', description: 'stage/trade：理由。trade 必填，写未来可验证的那一句' },
      trade: { type: 'string', enum: TRADE_ACTIONS, description: 'trade：open/add/reduce/close' },
      qty: { type: 'number', description: 'trade：股数' },
      price: { type: 'number', description: 'trade：成交价；guards 时传当前价' },
      triggerId: { type: 'string', description: 'trade：触发的规则编号（如 stop-loss、exit-3）' },
      force: { type: 'boolean', description: 'trade：跳过规则检查（必须同时给 overrideReason）' },
      overrideReason: { type: 'string', description: 'trade：为什么值得破例' },
      snapshot: { type: 'object', description: 'trade：动作当时的估值与关键指标快照' },
      text: { type: 'string', description: 'journal：这一条要记什么' },
      kind: { type: 'string', description: 'journal：记录类型，如 review/notice/error' },
      data: { type: 'object', description: 'journal：附带结构化数据' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        required: ['ok'],
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string' },
          blocked: { type: 'boolean' },
          violations: { type: 'array', items: { type: 'string' } },
          dossier: { type: 'object', additionalProperties: true },
          rows: { type: 'array', items: { type: 'object', additionalProperties: true } },
          count: { type: 'integer' },
          nextActions: { type: 'array', items: { type: 'string' } },
        },
      },
      render: (_args, value) => {
        const lines = []
        if (value.message) lines.push(value.message)
        if (value.dossier) {
          const d = value.dossier
          lines.push(`${d.symbol}${d.name ? ' ' + d.name : ''} · 阶段 ${d.stage} · 结论 ${d.verdict || '未出'} · 持仓 ${d.qty} 股 @ ${d.avgCost}`)
        }
        if (value.rows) {
          if (value.rows.length === 0) lines.push('还没有档案')
          for (const r of value.rows) lines.push(`${r.symbol} ${r.name || ''} · ${r.stage} · ${r.verdict || '-'} · ${r.qty ? r.qty + ' 股' : '空仓'}`)
        }
        if (value.dir) lines.push(`档案目录：${value.dir}`)
        if (value.violations && value.violations.length) {
          lines.push('规则检查：')
          for (const v of value.violations) lines.push('  ! ' + v)
        }
        if (value.nextActions && value.nextActions.length) {
          lines.push('下一步：')
          for (const n of value.nextActions) lines.push('  - ' + n)
        }
        return [{ type: 'text', text: lines.join('\n') || 'ok' }]
      },
    },
    async execute(args) {
      return handle(args.action, args, dir)
    },
  })

  ctx.tools.register({
    name: 'stock_playbook',
    description: '读取某一阶段的操作手册（八步能力拆分：调研/宪法/建仓/加仓/持有/减仓/清仓/复盘）。先读手册再动手。',
    parameters: {
      stage: {
        type: 'string',
        required: true,
        enum: ['conductor', 'research', 'plan', 'entry', 'add', 'hold', 'reduce', 'exit', 'review'],
        description: 'conductor=总纲与路由，其余对应八步中的一步',
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      const file = path.join(HERE, 'playbooks', args.stage + '.md')
      try {
        return { text: await fs.readFile(file, 'utf8') }
      } catch {
        throw new Error(`没有 ${args.stage} 的手册`)
      }
    },
  })

  try {
    ctx.systemPrompt && ctx.systemPrompt.section({
      name: 'tool:stock-os',
      order: 900,
      text: '涉及个股买卖、持仓管理、交易记录时：先用 stock_playbook 读对应阶段手册，再用 stock_os 读写档案。'
        + ' 本工具不预测涨跌；任何"该买了/该卖了"的判断都要落到规则条文与记录上。',
    })
  } catch {
    // A profile without the system-prompt service still gets both tools.
  }
}
