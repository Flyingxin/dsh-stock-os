/**
 * 结论报告（调研阶段的最终产物）。
 * 结构照 20_结论报告_版式样张：报告头 / 结论带 / 五维打分 / 12 项排雷 / 图表 / 证据链 / 下一步 / 页脚。
 * 数据只来自 stock_data 的数据集与档案里的 verdict，不做预测，缺数据就写"无法判断"。
 */

const STATUS_TEXT = {
  pass: '可以进入估值',
  watch: '先别下判断',
  fail: '不再往下看',
  suspect: '不建议作为标的',
  na: '数据不足，不出结论',
}
const STATUS_LABEL = {
  pass: '通过',
  watch: '观察',
  fail: '排除',
  suspect: '存疑',
  na: '数据不足',
}
const STATE_LABEL = { pass: '通过', bad: '异常', na: '无法判断' }

const SERIES_CN = {
  revenue: '营业收入',
  netProfit: '归母净利润',
  opCash: '经营活动现金流量净额',
  grossMargin: '毛利率',
  capex: '购建固定资产等支付的现金',
  receivables: '应收账款',
  inventory: '存货',
  cash: '货币资金',
  debt: '有息负债',
  equity: '归母净资产',
  totalAssets: '总资产',
  netMargin: '净利率',
  roe: 'ROE',
  dividend: '现金分红',
  buyback: '回购金额',
  equityRaise: '股权融资',
  pe: 'PE',
  pb: 'PB',
}

const SOURCE_CN = {
  revenue: '利润表 · 营业收入',
  netProfit: '利润表 · 归属于母公司股东的净利润',
  opCash: '现金流量表 · 经营活动产生的现金流量净额',
  grossMargin: '利润表 ·（营业收入−营业成本）÷营业收入',
  capex: '现金流量表 · 购建固定资产、无形资产和其他长期资产支付的现金',
  receivables: '资产负债表 · 应收账款',
  inventory: '资产负债表 · 存货',
  cash: '资产负债表 · 货币资金',
  debt: '资产负债表 · 短期借款+一年内到期非流动负债+长期借款+应付债券',
  equity: '资产负债表 · 归属于母公司所有者权益合计',
  totalAssets: '资产负债表 · 资产总计',
  netMargin: '利润表 · 净利润÷营业收入',
  roe: '净资产收益率（加权）',
  dividend: '股东回报 · 现金分红总额',
  buyback: '股东回报 · 回购金额',
  equityRaise: '筹资 · 股权融资净额',
  pe: '行情 · 市盈率 TTM',
  pb: '行情 · 市净率',
}

const CSS = `
:root{--bg:#f5f6f8;--card:#fff;--ink:#1f2329;--mut:#6b7280;--line:#e6e8eb;--accent:#2563eb;
--pass:#059669;--pass-bg:#e9f7f1;--watch:#d97706;--watch-bg:#fdf4e6;--bad:#dc2626;--bad-bg:#fdecec;
--suspect:#7c3aed;--suspect-bg:#f3eefe;--na:#6b7280;--na-bg:#f1f2f4;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.65 ui-sans-serif,system-ui,"PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:28px 24px 64px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:14px}
.hd h1{margin:0;font-size:22px;letter-spacing:.01em}
.hd .meta{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:8px;color:var(--mut);font-size:12px}
.band{border-left:5px solid var(--sv);background:var(--svbg);border-radius:12px;padding:16px 18px;margin-bottom:14px}
.band .tag{display:inline-flex;align-items:center;gap:6px;font-weight:700;color:var(--sv);font-size:15px}
.band .say{margin:8px 0 0;font-size:17px;font-weight:600;line-height:1.5}
.band .lim{margin:6px 0 0;color:var(--mut);font-size:12px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
.kpi{background:rgba(255,255,255,.72);border-radius:10px;padding:10px 12px}
.kpi b{display:block;font-size:19px;letter-spacing:-.01em}
.kpi span{color:var(--mut);font-size:11px}
h2{font-size:15px;margin:0 0 10px;display:flex;align-items:center;gap:8px}
h2 .n{font-size:11px;color:var(--mut);font-weight:500}
.dims{display:grid;grid-template-columns:110px 1fr 46px;gap:8px 12px;align-items:center;font-size:12.5px}
.bar{height:9px;background:#eef0f3;border-radius:6px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent);border-radius:6px}
.bar.na i{background:repeating-linear-gradient(45deg,#d8dbe0,#d8dbe0 4px,#eceef1 4px,#eceef1 8px)}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--mut);font-weight:500;font-size:11.5px;background:#fafbfc}
.st{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;font-weight:600;white-space:nowrap}
.st.pass{color:var(--pass);background:var(--pass-bg)}
.st.bad{color:var(--bad);background:var(--bad-bg)}
.st.na{color:var(--na);background:var(--na-bg)}
td.src{color:var(--mut);font-size:11.5px}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.chart{margin:0;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fcfcfd}
.chart h3{margin:0 0 4px;font-size:13px}
.chart .sub{color:var(--mut);font-size:11px;margin-bottom:6px}
.chart .box{height:210px}
.chart .note{margin-top:8px;font-size:12px;color:#374151}
.chart .fb{display:none;color:var(--mut);font-size:12px}
.ev{list-style:none;margin:0;padding:0}
.ev li{padding:9px 0;border-bottom:1px dashed var(--line);font-size:13px}
.ev li:last-child{border:0}
.ev .src{display:block;color:var(--mut);font-size:11.5px;margin-top:2px}
.hs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.hs div{border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-size:12px}
.hs .on{border-color:#f3c8c8;background:var(--bad-bg)}
.next{background:#f8fafc;border:1px dashed var(--line);border-radius:10px;padding:12px 14px;font-size:13px}
.next ol{margin:6px 0 0;padding-left:20px}
.foot{color:var(--mut);font-size:11.5px;line-height:1.7;margin-top:8px}
@media(max-width:760px){.kpis,.charts,.hs{grid-template-columns:1fr}}
@media print{body{background:#fff}.card{break-inside:avoid}}
`

function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function last(arr) {
  if (!Array.isArray(arr)) return null
  for (let i = arr.length - 1; i >= 0; i--) {
    const n = num(arr[i])
    if (n !== null) return n
  }
  return null
}
function lastIdx(arr) {
  if (!Array.isArray(arr)) return -1
  for (let i = arr.length - 1; i >= 0; i--) if (num(arr[i]) !== null) return i
  return -1
}
function growth(arr) {
  const i = lastIdx(arr)
  if (i <= 0) return null
  const cur = num(arr[i])
  for (let j = i - 1; j >= 0; j--) {
    const prev = num(arr[j])
    if (prev !== null && prev !== 0) return ((cur - prev) / Math.abs(prev)) * 100
  }
  return null
}
function money(v) {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(2) + ' 万亿'
  if (Math.abs(n) >= 1) return n.toFixed(1) + ' 亿'
  return (n * 1e4).toFixed(0) + ' 万'
}
function pct(v, d = 1) {
  return v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d) + '%'
}
function x(v, d = 2) {
  return v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d)
}
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 12 项排雷检查：能用数据集算的自动判，算不了的写"无法判断"并说明缺什么。 */
export function computeChecks(dataset) {
  const s = (dataset && dataset.series) || {}
  const ind = (dataset && dataset.industry) || {}
  const checks = []
  const push = (no, name, state, evidence, source) => checks.push({ no, name, state, evidence, source })

  const revG = growth(s.revenue)
  const cashG = growth(s.opCash)
  const profit = last(s.netProfit)
  const opCash = last(s.opCash)

  // 1 收入与现金同向
  if (revG !== null && cashG !== null) {
    const gap = cashG - revG
    const bad = (revG > 0 && cashG < 0) || gap < -20
    push(1, '收入与现金同向', bad ? 'bad' : 'pass',
      `收入 ${pct(revG)}、经营现金流 ${pct(cashG)}，差 ${gap.toFixed(1)} 个百分点`
      + (bad ? '：收入在走、现金在退' : '（同向，未见背离）'),
      '利润表 · 营业收入；现金流量表 · 经营活动现金流量净额')
  } else {
    push(1, '收入与现金同向', 'na', '收入或经营现金流缺相邻两年数据', '同上')
  }

  // 2 净利与现金（现金含量）
  if (profit !== null && profit !== 0 && opCash !== null) {
    const ratio = opCash / profit
    push(2, '净利与现金（现金含量）', ratio >= 1 ? 'pass' : 'bad',
      `净现比 ${x(ratio)}（${money(opCash)} ÷ ${money(profit)}）${ratio >= 1 ? '' : '：利润没有变成现金'}`,
      '现金流量表 · 经营活动净额 ÷ 利润表 · 归母净利润')
  } else {
    push(2, '净利与现金（现金含量）', 'na', '缺净利润或经营现金流', '同上')
  }

  // 3 毛利率与同行
  const gm = last(s.grossMargin)
  const gmInd = num(ind.grossMargin)
  if (gm !== null && gmInd !== null) {
    const diff = gm - gmInd
    push(3, '毛利率与同行', diff >= -3 ? 'pass' : 'bad',
      `本公司 ${pct(gm)}、行业 ${pct(gmInd)}，差 ${diff.toFixed(1)} 个百分点`,
      '利润表 · 毛利率；数据集 industry.grossMargin')
  } else {
    push(3, '毛利率与同行', 'na', '缺行业毛利率（industry.grossMargin）', '同上')
  }

  // 4 应收增速 vs 收入
  const arG = growth(s.receivables)
  if (arG !== null && revG !== null) {
    const gap = arG - revG
    push(4, '应收账款增速 vs 收入', gap <= 5 ? 'pass' : 'bad',
      `应收 ${pct(arG)}、收入 ${pct(revG)}，差 ${gap.toFixed(1)} 个百分点`,
      '资产负债表 · 应收账款；利润表 · 营业收入')
  } else {
    push(4, '应收账款增速 vs 收入', 'na', '缺应收账款或收入增速', '同上')
  }

  // 5 存货堆积
  const invG = growth(s.inventory)
  if (invG !== null && revG !== null) {
    const gap = invG - revG
    push(5, '存货堆积', gap <= 10 ? 'pass' : 'bad',
      `存货 ${pct(invG)}、收入 ${pct(revG)}，差 ${gap.toFixed(1)} 个百分点`,
      '资产负债表 · 存货；利润表 · 营业收入')
  } else {
    push(5, '存货堆积', 'na', '缺存货或收入增速', '同上')
  }

  // 6 货币资金与利息收入
  push(6, '货币资金与利息收入匹配', 'na',
    '数据集没有利息收入/利息费用科目——要判这个，去利润表"财务费用"附注抄两个数再回填',
    '利润表 · 财务费用附注（利息收入、利息费用）')

  // 7 存贷双高
  const cash = last(s.cash)
  const debt = last(s.debt)
  const assets = last(s.totalAssets)
  if (cash !== null && debt !== null) {
    const heavy = debt > 0 && cash > 0 && debt >= cash * 0.6 && (assets === null || debt / assets >= 0.15)
    push(7, '存贷双高', heavy ? 'bad' : 'pass',
      `货币资金 ${money(cash)}、有息负债 ${money(debt)}，有息负债/货币资金 ${x(debt / cash)}`,
      '资产负债表 · 货币资金；有息负债=短借+一年内到期非流动负债+长借+应付债券')
  } else {
    push(7, '存贷双高', 'na', '缺货币资金或有息负债', '同上')
  }

  // 8 商誉与长期资产
  push(8, '商誉与长期资产虚胖', 'na',
    '数据集没有商誉科目——资产负债表"商誉"一行除以净资产，超过 30% 就要逐条看并购标的业绩承诺',
    '资产负债表 · 商誉；附注 · 商誉减值测试')

  // 9 审计意见
  const audit = dataset && dataset.audit
  if (audit && audit.opinion) {
    const ok = /标准无保留|无保留意见/.test(String(audit.opinion))
    push(9, '审计意见', ok ? 'pass' : 'bad', `审计意见：${audit.opinion}`, '年报 · 审计报告')
  } else {
    push(9, '审计意见', 'na', '数据集未记录审计意见（dataset.audit.opinion）', '年报 · 审计报告')
  }

  // 10 非经常性损益
  push(10, '非经常性损益占比', 'na',
    '数据集没有扣非净利润——去"主要财务指标"里抄扣非净利润，与净利润比，超过 30% 就要看明细',
    '年报 · 主要会计数据和财务指标')

  // 11 关联方资金占用
  push(11, '关联方资金占用', 'na',
    '数据集没有其他应收款/关联方往来——去看"其他应收款"附注与关联交易公告',
    '资产负债表 · 其他应收款；附注 · 关联方')

  // 12 客户集中度
  push(12, '客户集中度突变', 'na',
    '数据集没有前五大客户占比——去 MD&A"主要销售客户"一节',
    '年报 · 管理层讨论与分析')

  return checks
}

function scoreDims(checks, dataset) {
  const s = (dataset && dataset.series) || {}
  const state = {}
  for (const c of checks) state[c.no] = c.state
  const score = (bases) => bases
  const dims = []

  // 利润质量：毛利率水平 + 净利润增速
  let p = 2
  const gm = last(s.grossMargin)
  if (gm !== null) p += gm >= 30 ? 1.4 : gm >= 15 ? 0.8 : 0.2
  const npG = growth(s.netProfit)
  if (npG !== null) p += npG > 10 ? 0.9 : npG > 0 ? 0.4 : 0
  dims.push({ name: '利润质量', score: Math.max(0, Math.min(5, p)), na: gm === null && npG === null })

  // 现金质量：净现比 + FCF
  let c = 1.4
  if (state[2] === 'pass') c += 1.8
  else if (state[1] === 'bad') c -= 0.6
  const fcf = (last(s.opCash) !== null && last(s.capex) !== null) ? last(s.opCash) - last(s.capex) : null
  if (fcf !== null) c += fcf > 0 ? 1.2 : 0
  dims.push({ name: '现金质量', score: Math.max(0, Math.min(5, c)), na: last(s.opCash) === null })

  // 资产质量：应收 / 存货 / 存贷双高
  let a = 2.2
  if (state[4] === 'pass') a += 1
  else if (state[4] === 'bad') a -= 1
  if (state[5] === 'pass') a += 0.8
  else if (state[5] === 'bad') a -= 0.8
  if (state[7] === 'bad') a -= 1
  dims.push({ name: '资产质量', score: Math.max(0, Math.min(5, a)), na: last(s.receivables) === null && last(s.inventory) === null })

  // 治理与披露：数据集不覆盖
  dims.push({ name: '治理与披露', score: null, na: true })

  // 估值位置：PE 与行业比
  const pe = last(s.pe)
  const peInd = num((dataset && dataset.industry || {}).pe)
  if (pe !== null && peInd !== null) {
    const v = pe <= peInd * 0.9 ? 4.4 : pe <= peInd * 1.1 ? 3.2 : 2
    dims.push({ name: '估值位置', score: v, na: false })
  } else {
    dims.push({ name: '估值位置', score: null, na: true })
  }
  return dims
}

function hardStops(dataset, verdict) {
  const out = []
  const s = (dataset && dataset.series) || {}
  const listed = new Set((verdict && verdict.hardStops) || [])
  const mark = (name) => listed.has(name) || [...listed].some(v => String(v).includes(name.slice(0, 4)))
  const audit = dataset && dataset.audit
  out.push({ name: '非标审计意见', hit: audit && audit.opinion ? !/标准无保留|无保留/.test(String(audit.opinion)) : mark('审计意见'), known: Boolean(audit && audit.opinion) })
  const oc = s.opCash || []
  const neg3 = oc.length >= 3 && oc.slice(-3).every(v => num(v) !== null && num(v) < 0)
  out.push({ name: '经营现金流连续三年为负', hit: neg3, known: oc.length >= 3 })
  const eq = last(s.equity)
  out.push({ name: '净资产为负', hit: eq !== null && eq < 0, known: eq !== null })
  out.push({ name: '商誉占净资产 >50%', hit: false, known: false })
  out.push({ name: '财务造假处罚记录', hit: mark('造假') || mark('处罚'), known: listed.size > 0 })
  out.push({ name: '控股股东资金占用', hit: mark('占用'), known: listed.size > 0 })
  return out
}

function buildCharts(dataset) {
  const s = dataset.series || {}
  const years = dataset.years || []
  const out = []
  if (last(s.revenue) !== null && years.length >= 2) {
    out.push({
      id: 'rv', wide: true, h: 240,
      title: '营业收入与毛利率',
      sub: '柱：营业收入（亿元，左轴）· 线：毛利率（%，右轴）',
      note: '收入涨、毛利率掉，通常意味着用价格换份额；两个一起掉才是需求出了问题。',
      opt: {
        grid: { left: 58, right: 56, top: 24, bottom: 30 },
        tooltip: { trigger: 'axis' },
        legend: { top: 0, textStyle: { fontSize: 11 } },
        xAxis: { type: 'category', data: years, axisLabel: { fontSize: 11 } },
        yAxis: [
          { type: 'value', name: '亿元', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { color: '#eef0f3' } } },
          { type: 'value', name: '%', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 11 }, splitLine: { show: false } },
        ],
        series: [
          { name: '营业收入', type: 'bar', data: s.revenue.map(v => num(v)), itemStyle: { color: '#93b4f5', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 26 },
          ...(Array.isArray(s.grossMargin) ? [{ name: '毛利率', type: 'line', yAxisIndex: 1, data: s.grossMargin.map(v => num(v)), smooth: true, symbolSize: 6, lineStyle: { width: 2, color: '#2563eb' }, itemStyle: { color: '#2563eb' } }] : []),
        ],
      },
    })
  }
  if (last(s.netProfit) !== null && last(s.opCash) !== null) {
    out.push({
      id: 'pc', h: 240,
      title: '净利润 vs 经营活动现金流',
      sub: '亿元；两者的缺口就是"利润没收到钱"的部分',
      note: '净利润连续高于经营现金流，是应收账款或存货在替利润买单。',
      opt: {
        grid: { left: 58, right: 20, top: 24, bottom: 30 },
        tooltip: { trigger: 'axis' },
        legend: { top: 0, textStyle: { fontSize: 11 } },
        xAxis: { type: 'category', data: years, axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value', name: '亿元', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { color: '#eef0f3' } } },
        series: [
          { name: '归母净利润', type: 'bar', data: s.netProfit.map(v => num(v)), itemStyle: { color: '#9ad9c2', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 20 },
          { name: '经营现金流', type: 'bar', data: s.opCash.map(v => num(v)), itemStyle: { color: '#f3c99a', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 20 },
        ],
      },
    })
  }
  const peArr = Array.isArray(s.pe) ? s.pe.filter(v => num(v) !== null) : []
  if (peArr.length >= 2) {
    out.push({
      id: 'pe', h: 240,
      title: 'PE 的五年位置',
      sub: '倍；亏损年没有 PE（断点）',
      note: 'PE 只在利润为正时才有意义；看的是"现在处在自己五年区间的哪一档"。',
      opt: {
        grid: { left: 46, right: 20, top: 24, bottom: 30 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: years, axisLabel: { fontSize: 11 }, boundaryGap: false },
        yAxis: { type: 'value', name: '倍', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { color: '#eef0f3' } } },
        series: [{ name: 'PE', type: 'line', data: s.pe.map(v => num(v)), connectNulls: false, smooth: true, symbolSize: 6, areaStyle: { color: 'rgba(37,99,235,.10)' }, lineStyle: { width: 2, color: '#2563eb' }, itemStyle: { color: '#2563eb' } }],
      },
    })
  }
  return out
}

function buildEvidence(dataset, checks, verdict) {
  const s = dataset.series || {}
  const rows = []
  const add = (claim, src) => rows.push({ claim, src })
  const revG = growth(s.revenue)
  if (revG !== null) add(`最新一年营业收入同比 ${pct(revG)}`, SOURCE_CN.revenue)
  const npG = growth(s.netProfit)
  if (npG !== null) add(`归母净利润同比 ${pct(npG)}`, SOURCE_CN.netProfit)
  for (const c of checks) {
    if (c.state === 'bad') add(`异常：${c.name}——${c.evidence}`, c.source)
  }
  for (const a of (verdict && verdict.anomalies) || []) add(`档案记录的异常：${a}`, '本次调研结论')
  if (verdict && verdict.sourcedAt) add(`数据截止 ${verdict.sourcedAt}`, '结论记录')
  if (!rows.length) add('数据集能算的指标都正常，但没有更多证据可展示——这不是"没问题"，是"还没查"', '数据集')
  return rows
}

export function buildReportHtml({ dossier, dataset, checks, nextActions }) {
  const verdict = (dossier && dossier.verdict) || null
  const status = (verdict && verdict.status) || 'na'
  const s = dataset.series || {}
  const years = dataset.years || []
  const span = years.length ? `${years[0]}–${years[years.length - 1]}` : '—'
  const dims = scoreDims(checks, dataset)
  const stops = hardStops(dataset, verdict)
  const charts = buildCharts(dataset)
  const evidence = buildEvidence(dataset, checks, verdict)

  const fcfSum = (() => {
    const o = s.opCash || []
    const c = s.capex || []
    let sum = 0
    let n = 0
    for (let i = 0; i < o.length; i++) {
      const a = num(o[i])
      const b = num(c[i])
      if (a !== null && b !== null) { sum += a - b; n++ }
    }
    return n ? sum : null
  })()
  const revCagr = (() => {
    const a = (s.revenue || []).map(num).filter(v => v !== null)
    if (a.length < 2) return null
    const n = a.length - 1
    const first = a[0]
    const lastV = a[a.length - 1]
    if (first <= 0 || lastV <= 0) return null
    return (Math.pow(lastV / first, 1 / n) - 1) * 100
  })()
  const opCash = last(s.opCash)
  const profit = last(s.netProfit)
  const netRatio = opCash !== null && profit ? opCash / profit : null

  const kpis = [
    { v: revCagr === null ? '—' : pct(revCagr), k: '营收 CAGR（' + (years.length ? years.length + ' 年' : '—') + '）' },
    { v: netRatio === null ? '—' : x(netRatio), k: '最新净现比（经营现金流÷净利润）' },
    { v: money(fcfSum), k: '五年累计自由现金流' },
    { v: last(s.roe) === null ? '—' : pct(last(s.roe)), k: '最新 ROE' },
  ]

  const passed = checks.filter(c => c.state === 'pass').length
  const failed = checks.filter(c => c.state === 'bad').length
  const unknown = checks.filter(c => c.state === 'na').length

  const svVar = { pass: '--pass', watch: '--watch', fail: '--bad', suspect: '--suspect', na: '--na' }[status]
  const svBgVar = { pass: '--pass-bg', watch: '--watch-bg', fail: '--bad-bg', suspect: '--suspect-bg', na: '--na-bg' }[status]

  const head = [
    esc((dossier && dossier.name) || dataset.name || ''),
    esc((dossier && dossier.symbol) || dataset.symbol || ''),
  ].filter(Boolean).join(' · ')

  const next = Array.isArray(nextActions) ? nextActions : []

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(head)} · 结论报告</title>
<style>${CSS}
.band{--sv:var(${svVar});--svbg:var(${svBgVar})}
</style>
</head>
<body>
<div class="wrap">

  <section class="card hd">
    <h1>${esc(head) || '结论报告'}</h1>
    <div class="meta">
      <span>报告期 ${esc(span)}</span>
      <span>数据截止 ${esc((verdict && verdict.sourcedAt) || dataset.sourcedAt || '—')}</span>
      <span>单位 ${esc(dataset.unit || '亿元')}</span>
      <span>数据来源 stock_data 五年数据集（${years.length} 年）</span>
      <span>生成时间 ${new Date().toISOString().slice(0, 19).replace('T', ' ')}</span>
    </div>
  </section>

  <section class="band">
    <div class="tag">${STATUS_LABEL[status] || status} · ${STATUS_TEXT[status] || ''}</div>
    <p class="say">${esc((verdict && verdict.summary) || '尚无一句话结论')}</p>
    <p class="lim">限定：本报告只读已披露财报数据，不预测股价；"异常"是事实，"造假"是结论，本报告只给前者。</p>
    <div class="kpis">
      ${kpis.map(k => `<div class="kpi"><b>${esc(k.v)}</b><span>${esc(k.k)}</span></div>`).join('\n      ')}
    </div>
  </section>

  <section class="card">
    <h2>五维打分 <span class="n">0–5 分，缺数据的一维直接留空，不用行业均值补</span></h2>
    <div class="dims">
      ${dims.map(d => `
      <div>${esc(d.name)}</div>
      <div class="bar${d.na ? ' na' : ''}"><i style="width:${d.na || d.score == null ? 100 : (d.score / 5) * 100}%"></i></div>
      <div>${d.na || d.score == null ? '—' : d.score.toFixed(1)}</div>`).join('')}
    </div>
  </section>

  <section class="card">
    <h2>排雷检查 <span class="n">12 项固定 · 通过 ${passed} / 异常 ${failed} / 无法判断 ${unknown}</span></h2>
    <table>
      <thead><tr><th style="width:34px">#</th><th style="width:150px">检查项</th><th style="width:78px">结论</th><th>读数</th><th style="width:200px">出处</th></tr></thead>
      <tbody>
      ${checks.map(c => `<tr>
        <td>${c.no}</td>
        <td>${esc(c.name)}</td>
        <td><span class="st ${c.state}">${STATE_LABEL[c.state]}</span></td>
        <td>${esc(c.evidence)}</td>
        <td class="src">${esc(c.source)}</td>
      </tr>`).join('\n      ')}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h2>硬性排除条件 <span class="n">命中任何一条就不再往下看</span></h2>
    <div class="hs">
      ${stops.map(h => `<div class="${h.hit ? 'on' : ''}">${h.hit ? '● 命中' : h.known ? '○ 未命中' : '？ 未核查'} · ${esc(h.name)}</div>`).join('\n      ')}
    </div>
  </section>

  <section class="card">
    <h2>图表 <span class="n">只画数据支持的图</span></h2>
    <div class="charts">
      ${charts.map(c => `<figure class="chart"${c.wide ? ' style="grid-column:1/-1"' : ''}>
        <h3>${esc(c.title)}</h3>
        <div class="sub">${esc(c.sub)}</div>
        <div class="box" id="chart-${c.id}" style="height:${c.h || 220}px"></div>
        <div class="fb" id="fb-${c.id}">图表需要联网加载 ECharts；下面的结论不受影响。</div>
        <div class="note">${esc(c.note)}</div>
      </figure>`).join('\n      ')}
    </div>
  </section>

  <section class="card">
    <h2>证据链 <span class="n">每条都能回到报表某一行</span></h2>
    <ul class="ev">
      ${evidence.map(e => `<li>${esc(e.claim)}<span class="src">出处：${esc(e.src)}</span></li>`).join('\n      ')}
    </ul>
  </section>

  <section class="card">
    <h2>下一步</h2>
    <div class="next">
      ${next.length ? `<ol>${next.map(n => `<li>${esc(n)}</li>`).join('')}</ol>` : esc('按阶段手册继续：先定策略宪法，再等信号。')}
    </div>
  </section>

  <div class="foot">
    口径：金额单位 ${esc(dataset.unit || '亿元')}；净现比=经营活动现金流量净额÷归母净利润；自由现金流=经营现金流−购建长期资产支付的现金。<br>
    未覆盖：利息收入匹配、商誉、非经常性损益、关联方占用、客户集中度等 6 项没有数据集字段，报告里标"无法判断"而不是猜。<br>
    本报告由 dsh-stock-os 生成，不构成投资建议；有效期至下一次定期报告披露。
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<script>
const CH = ${JSON.stringify(charts.map(c => ({ id: c.id, opt: c.opt })))};
(function () {
  if (!window.echarts) {
    CH.forEach(function (c) {
      var el = document.getElementById('chart-' + c.id);
      var fb = document.getElementById('fb-' + c.id);
      if (el) el.style.display = 'none';
      if (fb) fb.style.display = 'block';
    });
    return;
  }
  CH.forEach(function (c) {
    var el = document.getElementById('chart-' + c.id);
    if (!el) return;
    var chart = echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption(c.opt);
    window.addEventListener('resize', function () { chart.resize(); });
  });
})();
</script>
</body>
</html>`
}
