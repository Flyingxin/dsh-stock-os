/**
 * Five-year financial dataset: the gate in front of any research conclusion.
 *
 * A verdict written without the numbers is just an opinion, so the ledger
 * refuses to record one until a dataset exists and passes `check()`.
 *
 *   <dataDir>/data/<symbol>.json
 *
 * Shape (all series are arrays aligned to `years`, null = 该年缺失):
 * {
 *   schema: 1, symbol, name, unit: "亿元", sourcedAt,
 *   years: [2021, 2022, 2023, 2024, 2025],
 *   series: {
 *     revenue, netProfit, grossMargin, opCash, capex,
 *     receivables, inventory, cash, debt, equity, totalAssets,
 *     netMargin, roe, dividend, buyback, equityRaise, pe, pb
 *   },
 *   industry: { revenueGrowth, grossMargin, roe, debtRatio },
 *   quarters: { labels, revenue, grossMargin }
 * }
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const CORE_SERIES = ['revenue', 'netProfit', 'opCash']
export const EXTRA_SERIES = [
  'grossMargin', 'capex', 'receivables', 'inventory', 'cash',
  'debt', 'equity', 'totalAssets', 'netMargin', 'roe',
  'dividend', 'buyback', 'equityRaise', 'pe', 'pb',
]
export const ALL_SERIES = [...CORE_SERIES, ...EXTRA_SERIES]

export const SERIES_LABEL = {
  revenue: '营业收入',
  netProfit: '归母净利润',
  opCash: '经营活动现金流净额',
  grossMargin: '毛利率(%)',
  capex: '购建固定资产等支付的现金',
  receivables: '应收账款',
  inventory: '存货',
  cash: '货币资金',
  debt: '有息负债',
  equity: '归母净资产',
  totalAssets: '总资产',
  netMargin: '净利率(%)',
  roe: '加权ROE(%)',
  dividend: '现金分红',
  buyback: '回购金额',
  equityRaise: '股权融资',
  pe: 'PE(TTM)',
  pb: 'PB',
}

/** Where to look when a series is missing — used in the error message. */
export const SERIES_SOURCE = {
  revenue: '利润表·营业总收入',
  netProfit: '利润表·归属于母公司股东的净利润',
  opCash: '现金流量表·经营活动产生的现金流量净额',
  grossMargin: '利润表·(营业收入−营业成本)/营业收入',
  capex: '现金流量表·购建固定资产、无形资产和其他长期资产支付的现金',
  receivables: '资产负债表·应收账款（含应收款项融资时可注明）',
  inventory: '资产负债表·存货',
  cash: '资产负债表·货币资金',
  debt: '资产负债表·短期借款+一年内到期非流动负债+长期借款+应付债券+租赁负债',
  equity: '资产负债表·归属于母公司所有者权益合计',
  totalAssets: '资产负债表·资产总计',
  netMargin: '利润表·净利润/营业总收入',
  roe: '年报·加权平均净资产收益率',
  dividend: '所有者权益变动表·对股东的分配 / 分红公告',
  buyback: '公告·回购金额',
  equityRaise: '现金流量表·吸收投资收到的现金',
  pe: '行情·PE(TTM)，亏损年为 null',
  pb: '行情·PB',
}

const MIN_YEARS = 5

export const datasetPath = (dir, symbol) => path.join(dir, 'data', symbol + '.json')

export async function readDataset(dir, symbol) {
  try {
    const text = await fs.readFile(datasetPath(dir, symbol), 'utf8')
    return JSON.parse(text)
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw new Error(`读取数据集失败：${error.message}`)
  }
}

export async function writeDataset(dir, symbol, dataset) {
  const file = datasetPath(dir, symbol)
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(dataset, null, 2) + '\n', 'utf8')
  await fs.rename(tmp, file)
  return file
}

const isNum = v => typeof v === 'number' && Number.isFinite(v)

/**
 * Validate a dataset. Returns a report instead of throwing so the caller can
 * show the human what is missing and where to get it.
 */
export function checkDataset(dataset) {
  const report = {
    ok: false,
    symbol: dataset && dataset.symbol,
    years: [],
    unit: (dataset && dataset.unit) || '亿元',
    missing: [],
    problems: [],
    nulls: [],
    coverage: 0,
    present: [],
  }
  if (!dataset || typeof dataset !== 'object') {
    report.problems.push('没有数据集')
    return report
  }
  const years = Array.isArray(dataset.years) ? dataset.years : []
  report.years = years
  if (years.length < MIN_YEARS) {
    report.problems.push(`只给了 ${years.length} 年，至少要 ${MIN_YEARS} 年（近五年年报）`)
  }
  if (years.some((y, i) => !isNum(y) || (i > 0 && y <= years[i - 1]))) {
    report.problems.push('years 必须是递增的年份数字')
  }
  const n = years.length || 0
  for (const key of ALL_SERIES) {
    const raw = dataset.series ? dataset.series[key] : undefined
    if (raw === undefined || raw === null) {
      report.missing.push({ key, label: SERIES_LABEL[key], source: SERIES_SOURCE[key] })
      continue
    }
    if (!Array.isArray(raw)) {
      report.problems.push(`series.${key} 必须是数组`)
      continue
    }
    if (raw.length !== n) {
      report.problems.push(`series.${key} 长度 ${raw.length} ≠ ${n} 年`)
      continue
    }
    const bad = raw.filter(v => v !== null && !isNum(v))
    if (bad.length) {
      report.problems.push(`series.${key} 含非数字值`)
      continue
    }
    report.present.push(key)
    if (raw.every(v => v === null)) {
      report.nulls.push({ key, label: SERIES_LABEL[key] })
    }
  }
  for (const key of CORE_SERIES) {
    const raw = dataset.series ? dataset.series[key] : undefined
    if (Array.isArray(raw) && raw.some(v => v === null)) {
      report.problems.push(`${SERIES_LABEL[key]}（${key}）有空值：这张表是结论的地基，不能缺年`)
    }
  }
  const filled = (dataset.series ? report.present : []).length
  report.coverage = ALL_SERIES.length ? filled / ALL_SERIES.length : 0
  const extras = report.present.filter(k => !CORE_SERIES.includes(k)).length
  if (extras < 3) {
    report.problems.push('除三张表主干外，至少再补 3 项（毛利率/应收/存货/货币资金/有息负债/ROE/PE…），否则图只能画一张')
  }
  report.ok = report.problems.length === 0
  return report
}

/** Compact one-line summary used by tools and the panel. */
export function describeDataset(dataset) {
  if (!dataset) return '无数据集'
  const years = Array.isArray(dataset.years) ? dataset.years : []
  return `${dataset.symbol || '?'} ${years.length} 年 ${years[0] || '?'}–${years[years.length - 1] || '?'}`
}
