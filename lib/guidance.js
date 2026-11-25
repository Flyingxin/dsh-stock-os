/**
 * Shared stage router for Agent tools and the Client panel.
 * Answers: where am I, what's ready, what should I do next.
 */

export const STAGES = ['idea', 'research', 'plan', 'open', 'hold', 'closed']

export const STAGE_LABEL = {
  idea: '立项',
  research: '买前调研',
  plan: '立宪法',
  open: '建仓',
  hold: '持有',
  closed: '已清仓',
}

const PASS_VERDICTS = new Set(['pass', 'watch'])

function call(tool, args) {
  return { tool, args }
}

function namePart(dossier) {
  return dossier.name ? `（${dossier.name}）` : ''
}

function who(dossier) {
  return `${dossier.symbol}${namePart(dossier)}`
}

function isReviewOverdue(dossier) {
  const due = dossier.plans && dossier.plans.reviewDueAt
  if (!due) return false
  const t = Date.parse(due)
  if (Number.isNaN(t)) return false
  return t < Date.now()
}

/**
 * @param {object} dossier raw dossier JSON
 * @param {object|null} datasetReport result of checkDataset, or null if no dataset
 * @param {{ hasReview?: boolean }} [opts]
 */
export function buildReadiness(dossier, datasetReport, opts = {}) {
  const datasetOk = Boolean(datasetReport && datasetReport.ok)
  const verdict = dossier.verdict || null
  const hasVerdict = Boolean(verdict && verdict.status)
  const constitution = Boolean(dossier.constitution)
  const drawdownPlan = Boolean(dossier.plans && dossier.plans.drawdownPlan)
  const reviewDueAt = (dossier.plans && dossier.plans.reviewDueAt) || null
  const reviewOverdue = isReviewOverdue(dossier)
  const hasReview = opts.hasReview === true

  return {
    dataset: datasetOk,
    datasetCoverage: datasetReport ? datasetReport.coverage : 0,
    verdict: hasVerdict,
    verdictStatus: hasVerdict ? verdict.status : null,
    constitution,
    drawdownPlan,
    reviewDueAt,
    reviewOverdue,
    hasReview,
    holding: Boolean(dossier.position && dossier.position.qty > 0),
  }
}

export function buildBlockers(dossier, readiness) {
  const blockers = []
  const stage = dossier.stage

  if ((stage === 'idea' || stage === 'research') && !readiness.dataset) {
    blockers.push({
      code: 'dataset_incomplete',
      message: '近五年财报数据集未通过 check，不能写非 na 的买前结论',
    })
  }
  if (stage === 'research' && readiness.dataset && !readiness.verdict) {
    blockers.push({
      code: 'no_verdict',
      message: '还没有买前结论（verdict）',
    })
  }
  if ((stage === 'research' || stage === 'plan') && readiness.verdict && !PASS_VERDICTS.has(readiness.verdictStatus)) {
    if (readiness.verdictStatus && readiness.verdictStatus !== 'na') {
      blockers.push({
        code: 'verdict_blocks_buy',
        message: `结论是 ${readiness.verdictStatus}，不允许建仓；只能退回调研或关闭`,
      })
    }
  }
  if ((stage === 'plan' || stage === 'open') && !readiness.constitution) {
    blockers.push({
      code: 'no_constitution',
      message: '没有策略宪法，交易工具会拒绝建仓',
    })
  }
  if ((stage === 'plan' || stage === 'open') && !readiness.drawdownPlan) {
    blockers.push({
      code: 'no_drawdown_plan',
      message: '没有回撤预案，不能进入 plan / 建仓',
    })
  }
  if ((stage === 'open' || stage === 'hold') && readiness.reviewOverdue) {
    blockers.push({
      code: 'review_overdue',
      message: `复盘已逾期（应于 ${String(readiness.reviewDueAt).slice(0, 10)} 前完成）`,
    })
  }
  if (stage === 'closed' && !readiness.hasReview) {
    blockers.push({
      code: 'no_review',
      message: '清仓后还没有复盘流水（kind=review）',
    })
  }
  return blockers
}

function nextCollectDataset(dossier) {
  const symbol = dossier.symbol
  return {
    intent: 'collect_dataset',
    title: '收集并检查近五年财报数据',
    why: '没有通过 check 的数据集，买前结论写不进去（唯一例外是 na）。',
    playbook: 'research',
    suggestedCalls: [
      call('stock_playbook', { stage: 'research' }),
      call('stock_data', { action: 'check', symbol }),
      call('stock_data', { action: 'set', symbol, dataset: '{…补齐后写入}' }),
    ],
    chatPrompt: `${who(dossier)} 的五年数据集还不完整：先 stock_status 看现状，再 stock_data action=check 看缺什么，补完写回；不要在没有通过 check 前写 verdict。`,
  }
}

function nextWriteVerdict(dossier) {
  const symbol = dossier.symbol
  return {
    intent: 'write_verdict',
    title: '完成买前调研并写入结论',
    why: '数据已就绪，按 research 手册九项核查后写入 verdict，再出结论报告。',
    playbook: 'research',
    suggestedCalls: [
      call('stock_playbook', { stage: 'research' }),
      call('stock_notes', { action: 'search', query: '护城河 应收 现金流' }),
      call('stock_charts', { action: 'emit', symbol }),
      call('stock_os', { action: 'verdict', symbol, status: 'pass|watch|fail|suspect|na', summary: '…' }),
      call('stock_report', { action: 'emit', symbol }),
    ],
    chatPrompt: `调研 ${who(dossier)}。数据已通过 check：按 stock_playbook stage=research 给结论，用 stock_os verdict 写入，再用 stock_report 出结论报告。`,
  }
}

function nextWriteConstitution(dossier) {
  const symbol = dossier.symbol
  return {
    intent: 'write_constitution',
    title: '把结论翻成策略宪法与回撤预案',
    why: '没有宪法和回撤预案，建仓会被硬拦。',
    playbook: 'plan',
    suggestedCalls: [
      call('stock_playbook', { stage: 'plan' }),
      call('stock_os', { action: 'constitution', symbol, constitution: '{…}' }),
      call('stock_os', { action: 'plan', symbol, drawdownPlan: '…', reviewDueAt: '…' }),
      call('stock_os', { action: 'stage', symbol, to: 'plan' }),
    ],
    chatPrompt: `基于 ${who(dossier)} 的买前结论，一起定策略宪法与回撤预案，写完用 stock_os constitution / plan 写入，再 stage=plan。`,
  }
}

function nextEnterPlan(dossier) {
  const symbol = dossier.symbol
  return {
    intent: 'enter_plan',
    title: '推进到 plan 阶段，等待建仓信号',
    why: '宪法与回撤预案已齐，把阶段落到 plan，避免还停在 research。',
    playbook: 'plan',
    suggestedCalls: [
      call('stock_os', { action: 'stage', symbol, to: 'plan', reason: '宪法与回撤预案已就绪' }),
    ],
    chatPrompt: `${who(dossier)} 的宪法与回撤预案已写好：用 stock_os stage 推进到 plan，并告诉我建仓前还缺什么信号。`,
  }
}

function nextOpenPosition(dossier) {
  const symbol = dossier.symbol
  return {
    intent: 'open_position',
    title: '等信号后按首笔上限建仓',
    why: '处于 plan：先 guards，再按宪法第一笔 open；建仓后阶段会进入 hold。',
    playbook: 'entry',
    suggestedCalls: [
      call('stock_playbook', { stage: 'entry' }),
      call('stock_os', { action: 'guards', symbol, price: 0 }),
      call('stock_os', { action: 'trade', symbol, trade: 'open', qty: 0, price: 0, reason: '…' }),
    ],
    chatPrompt: `${who(dossier)} 准备评估建仓：先 stock_next，再 guards（我会给现价），对照宪法给首笔股数；我确认后再 trade=open。`,
  }
}

function nextHoldReview(dossier) {
  const symbol = dossier.symbol
  const due = dossier.plans && dossier.plans.reviewDueAt
  return {
    intent: 'review_overdue',
    title: '复盘已逾期，先做定期复盘',
    why: `应于 ${String(due).slice(0, 10)} 前复盘，逾期后再动手容易靠感觉改规则。`,
    playbook: 'review',
    suggestedCalls: [
      call('stock_playbook', { stage: 'review' }),
      call('stock_os', { action: 'guards', symbol, price: 0 }),
      call('stock_os', { action: 'journal', symbol, kind: 'review', text: '…' }),
    ],
    chatPrompt: `${who(dossier)} 复盘已逾期。按 stock_playbook stage=review 四问过一遍，结论写入 journal（kind=review），并更新下次复盘日。`,
  }
}

function nextHoldMonitor(dossier) {
  const symbol = dossier.symbol
  return {
    intent: 'hold_monitor',
    title: '持有期监测：先跑规则再决定加减仓',
    why: '持有是最长阶段；任何买卖前先 guards，理由写未来可验证的那一句。',
    playbook: 'hold',
    suggestedCalls: [
      call('stock_playbook', { stage: 'hold' }),
      call('stock_os', { action: 'guards', symbol, price: 0 }),
    ],
    chatPrompt: `打开 ${who(dossier)} 的持仓账本：先 stock_status / stock_next，再 guards（我会给现价），告诉我今天有没有触发止损/止盈/失效；没触发就只说无动作。`,
    alternatives: [
      {
        intent: 'add_position',
        title: '检查是否满足加仓',
        playbook: 'add',
        suggestedCalls: [call('stock_playbook', { stage: 'add' })],
      },
      {
        intent: 'reduce_position',
        title: '检查是否该减仓',
        playbook: 'reduce',
        suggestedCalls: [call('stock_playbook', { stage: 'reduce' })],
      },
      {
        intent: 'exit_position',
        title: '检查是否触发清仓',
        playbook: 'exit',
        suggestedCalls: [call('stock_playbook', { stage: 'exit' })],
      },
    ],
  }
}

function nextClosedReview(dossier) {
  const symbol = dossier.symbol
  return {
    intent: 'write_review',
    title: '清仓后写复盘',
    why: '没有复盘的清仓只剩情绪记忆；把可预见与运气分开写进流水。',
    playbook: 'review',
    suggestedCalls: [
      call('stock_playbook', { stage: 'review' }),
      call('stock_os', { action: 'journal', symbol, kind: 'review', text: '…' }),
    ],
    chatPrompt: `对 ${who(dossier)} 这笔已清仓交易做复盘：按当时信息重放，结论写入 journal（kind=review），并建议要不要改宪法。`,
  }
}

function nextClosedDone(dossier) {
  return {
    intent: 'closed_done',
    title: '本轮已结束',
    why: '已有复盘流水。若要重开研究，新建调研或退回 research（若状态机允许）。',
    playbook: 'conductor',
    suggestedCalls: [
      call('stock_playbook', { stage: 'conductor' }),
      call('stock_status', { symbol: dossier.symbol }),
    ],
    chatPrompt: `${who(dossier)} 已清仓且有复盘。总结本轮规则得失；若要重开，告诉我从哪一步开始。`,
  }
}

/**
 * Pick the single primary next step from stage + readiness.
 */
export function resolveNext(dossier, readiness) {
  const stage = dossier.stage
  const vStatus = readiness.verdictStatus

  if (stage === 'idea') {
    if (!readiness.dataset) return nextCollectDataset(dossier)
    if (!readiness.verdict) return nextWriteVerdict(dossier)
    if (!PASS_VERDICTS.has(vStatus)) {
      return {
        intent: 'verdict_reject',
        title: '结论未通过，决定退回或关闭',
        why: `结论是 ${vStatus || '空'}，不应继续立宪法建仓。`,
        playbook: 'research',
        suggestedCalls: [
          call('stock_os', { action: 'stage', symbol: dossier.symbol, to: 'closed', reason: '调研不通过' }),
        ],
        chatPrompt: `${who(dossier)} 结论是 ${vStatus}。一起决定是退回补调研还是关闭档案。`,
      }
    }
    return nextWriteConstitution(dossier)
  }

  if (stage === 'research') {
    if (!readiness.dataset) return nextCollectDataset(dossier)
    if (!readiness.verdict) return nextWriteVerdict(dossier)
    if (!PASS_VERDICTS.has(vStatus)) {
      return {
        intent: 'verdict_reject',
        title: '结论未通过，不要立宪法',
        why: `结论是 ${vStatus}，硬规则不允许建仓。`,
        playbook: 'research',
        suggestedCalls: [
          call('stock_report', { action: 'emit', symbol: dossier.symbol }),
          call('stock_os', { action: 'stage', symbol: dossier.symbol, to: 'closed', reason: '调研不通过' }),
        ],
        chatPrompt: `${who(dossier)} 结论是 ${vStatus}。出结论报告后决定关闭或补调研。`,
      }
    }
    if (!readiness.constitution || !readiness.drawdownPlan) return nextWriteConstitution(dossier)
    return nextEnterPlan(dossier)
  }

  if (stage === 'plan') {
    if (!readiness.constitution || !readiness.drawdownPlan) return nextWriteConstitution(dossier)
    return nextOpenPosition(dossier)
  }

  if (stage === 'open' || stage === 'hold') {
    if (readiness.reviewOverdue) return nextHoldReview(dossier)
    return nextHoldMonitor(dossier)
  }

  if (stage === 'closed') {
    if (!readiness.hasReview) return nextClosedReview(dossier)
    return nextClosedDone(dossier)
  }

  return {
    intent: 'unknown_stage',
    title: '未知阶段',
    why: `阶段 ${stage} 不在状态机内`,
    playbook: 'conductor',
    suggestedCalls: [call('stock_playbook', { stage: 'conductor' })],
    chatPrompt: `档案 ${who(dossier)} 阶段异常（${stage}），先 stock_status 再决定。`,
  }
}

/** Human-readable string list (compat with old nextActions). */
export function nextActionLines(next) {
  if (!next) return []
  const lines = [next.title]
  if (next.why) lines.push(next.why)
  if (next.playbook) lines.push(`手册：stock_playbook stage=${next.playbook}`)
  return lines
}

/**
 * @param {object} dossier
 * @param {object|null} datasetReport
 * @param {{ hasReview?: boolean }} [opts]
 */
export function buildStatus(dossier, datasetReport, opts = {}) {
  const readiness = buildReadiness(dossier, datasetReport, opts)
  const blockers = buildBlockers(dossier, readiness)
  const stage = dossier.stage
  return {
    symbol: dossier.symbol,
    name: dossier.name || null,
    stage,
    stageLabel: STAGE_LABEL[stage] || stage,
    stageOrder: STAGES,
    readiness,
    blockers,
    position: {
      qty: (dossier.position && dossier.position.qty) || 0,
      avgCost: (dossier.position && dossier.position.avgCost) || 0,
    },
    verdict: dossier.verdict
      ? { status: dossier.verdict.status, summary: dossier.verdict.summary || null }
      : null,
    reviewDueAt: readiness.reviewDueAt,
    updatedAt: dossier.updatedAt || null,
  }
}

/**
 * @param {object} dossier
 * @param {object|null} datasetReport
 * @param {{ hasReview?: boolean, price?: number|null }} [opts]
 */
export function buildNext(dossier, datasetReport, opts = {}) {
  const status = buildStatus(dossier, datasetReport, opts)
  const next = resolveNext(dossier, status.readiness)
  if (!next.alternatives) next.alternatives = []

  const result = {
    ...status,
    next,
    nextActions: nextActionLines(next),
    guidance: {
      readiness: status.readiness,
      blockers: status.blockers,
      next,
      nextActions: nextActionLines(next),
    },
  }

  if (opts.price != null && opts.price !== '' && Number(opts.price) > 0) {
    result.price = Number(opts.price)
    result.guardsHint = '动作前先 stock_os action=guards，并传入当前价'
  }

  return result
}

/** Compact portfolio row for stock_status without symbol. */
export function summariseStatusRow(dossier, datasetReport) {
  const readiness = buildReadiness(dossier, datasetReport)
  return {
    symbol: dossier.symbol,
    name: dossier.name || null,
    stage: dossier.stage,
    stageLabel: STAGE_LABEL[dossier.stage] || dossier.stage,
    verdict: readiness.verdictStatus,
    dataset: readiness.dataset,
    holding: readiness.holding,
    qty: (dossier.position && dossier.position.qty) || 0,
    reviewOverdue: readiness.reviewOverdue,
    updatedAt: dossier.updatedAt || null,
  }
}
