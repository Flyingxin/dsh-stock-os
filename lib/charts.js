/**
 * Turn a five-year dataset into a chart-first HTML page.
 *
 * Rules taken from the notes' visualisation chapter: one chart answers one
 * question, every chart carries how to read it, and a chart that cannot be
 * drawn from the data is dropped (never faked with an estimate).
 */
import { checkDataset, SERIES_LABEL } from './dataset.js'

const COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#dc2626', '#7c3aed', '#0891b2']
const IND = '#94a3b8'

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const round = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)
const pct = v => (v == null ? '—' : `${v > 0 ? '+' : ''}${round(v, 1)}%`)

function cagr(series) {
  const clean = series.map(num)
  const first = clean.find(v => v != null && v > 0)
  const last = [...clean].reverse().find(v => v != null && v > 0)
  const firstIndex = clean.indexOf(first)
  const lastIndex = clean.length - 1 - [...clean].reverse().indexOf(last)
  if (first == null || last == null || lastIndex <= firstIndex) return null
  const n = lastIndex - firstIndex
  return ((last / first) ** (1 / n) - 1) * 100
}

function yoy(series) {
  return series.map((v, i) => {
    if (i === 0) return null
    const prev = num(series[i - 1])
    const cur = num(v)
    if (prev == null || cur == null || prev === 0) return null
    return round(((cur - prev) / Math.abs(prev)) * 100, 1)
  })
}

function pickLast(series) {
  for (let i = series.length - 1; i >= 0; i -= 1) if (num(series[i]) != null) return num(series[i])
  return null
}

function percentile(series, value) {
  const clean = series.map(num).filter(v => v != null)
  if (!clean.length || value == null) return null
  const below = clean.filter(v => v < value).length
  return Math.round((below / clean.length) * 100)
}

const baseAxis = years => ({
  type: 'category',
  data: years,
  boundaryGap: true,
  axisLine: { lineStyle: { color: '#e6e9ef' } },
  axisTick: { show: false },
  axisLabel: { color: '#8b94a3', fontSize: 11 },
})

const valAxis = (name, opts = {}) => ({
  type: 'value',
  name,
  nameTextStyle: { color: '#8b94a3', fontSize: 11, padding: [0, 0, 0, 4] },
  splitLine: { lineStyle: { color: '#eef1f5' } },
  axisLabel: { color: '#8b94a3', fontSize: 11 },
  ...opts,
})

function tooltip() {
  return { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true, textStyle: { fontSize: 12 } }
}

const legend = () => ({ top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#5b6472', fontSize: 11.5 } })

/** Build every chart the data can support. */
export function buildCharts(dataset) {
  const years = dataset.years || []
  const S = dataset.series || {}
  const unit = dataset.unit || '亿元'
  const I = dataset.industry || {}
  const has = key => Array.isArray(S[key]) && S[key].some(v => num(v) != null)
  const charts = []

  if (has('revenue')) {
    const revenue = S.revenue.map(num)
    const parts = [{ name: `营业收入（${unit}）`, type: 'bar', data: revenue, itemStyle: { color: COLORS[0], borderRadius: [3, 3, 0, 0] } }]
    const axes = [valAxis(unit)]
    if (has('grossMargin')) {
      parts.push({ name: '毛利率(%)', type: 'line', yAxisIndex: 1, data: S.grossMargin.map(num), smooth: true, symbolSize: 6, itemStyle: { color: COLORS[1] }, lineStyle: { width: 2 } })
      axes.push(valAxis('%', { position: 'right', splitLine: { show: false } }))
    }
    charts.push({
      key: 'revenue',
      title: '收入在长，还是在原地打转',
      read: '看柱高变化；毛利率是拐点信号，收入创新高但毛利率掉头，通常是周期见顶',
      option: { tooltip: tooltip(), legend: legend(), grid: { left: 52, right: 46, top: 30, bottom: 26 }, xAxis: baseAxis(years), yAxis: axes, series: parts },
      conclusion: cagr(revenue) == null ? '营收 CAGR 缺数据' : '营收 ' + years.length + ' 年 CAGR ' + round(cagr(revenue), 1) + '%',
    })
  }

  if (has('netProfit') || has('opCash')) {
    const parts = []
    if (has('netProfit')) parts.push({ name: '归母净利润', type: 'bar', data: S.netProfit.map(num), itemStyle: { color: COLORS[0], borderRadius: [3, 3, 0, 0] } })
    if (has('opCash')) parts.push({ name: '经营现金流', type: 'bar', data: S.opCash.map(num), itemStyle: { color: COLORS[2], borderRadius: [3, 3, 0, 0] } })
    charts.push({
      key: 'profit-cash',
      title: '赚的是不是现金',
      read: '两根柱应大致等高；现金流长期低于净利润，说明利润停在应收和存货里',
      option: { tooltip: tooltip(), legend: legend(), grid: { left: 52, right: 24, top: 30, bottom: 26 }, xAxis: baseAxis(years), yAxis: [valAxis(unit)], series: parts },
      conclusion: (() => {
        const np = pickLast(S.netProfit || [])
        const oc = pickLast(S.opCash || [])
        if (np == null || oc == null) return '缺一项，无法比较'
        const r = oc / np
        return `最新净现比 ${round(r, 2)}，${r >= 1 ? '利润有现金支撑' : '利润没有现金支撑'}`
      })(),
    })
  }

  if (has('netProfit') && has('opCash')) {
    const ratio = years.map((_, i) => {
      const np = num(S.netProfit[i])
      const oc = num(S.opCash[i])
      return np && oc != null ? round(oc / np, 2) : null
    })
    charts.push({
      key: 'cash-ratio',
      title: '净现比：每 1 元利润收回多少现金',
      read: '1.0 是及格线；连续多年低于 0.8 要去看应收与存货；远高于 1.5 可能是预收在增厚',
      option: {
        tooltip: tooltip(),
        grid: { left: 46, right: 24, top: 26, bottom: 26 },
        xAxis: baseAxis(years),
        yAxis: [valAxis('倍')],
        series: [{
          name: '净现比', type: 'bar',
          data: ratio.map(v => ({ value: v, itemStyle: { color: v != null && v >= 1 ? COLORS[2] : COLORS[3] } })),
          itemStyle: { borderRadius: [3, 3, 0, 0] },
          markLine: { silent: true, symbol: 'none', data: [{ yAxis: 1 }], lineStyle: { color: '#8b94a3', type: 'dashed' }, label: { formatter: '1.0', color: '#8b94a3', fontSize: 10 } },
        }],
      },
      conclusion: (() => {
        const r = pickLast(ratio)
        return r == null ? '缺数据' : `最新 ${round(r, 2)} 倍`
      })(),
    })
  }

  if (has('opCash') && has('capex')) {
    const fcf = years.map((_, i) => {
      const oc = num(S.opCash[i])
      const cx = num(S.capex[i])
      return oc != null && cx != null ? round(oc - cx, 1) : null
    })
    const neg = fcf.filter(v => v != null && v < 0).length
    charts.push({
      key: 'fcf',
      title: '自由现金流：扩张是自己掏钱还是靠融资',
      read: '经营现金流减资本开支；长期为负而收入在涨，要问钱从哪来',
      option: {
        tooltip: tooltip(),
        grid: { left: 52, right: 24, top: 26, bottom: 26 },
        xAxis: baseAxis(years),
        yAxis: [valAxis(unit)],
        series: [{
          name: '自由现金流', type: 'bar',
          data: fcf.map(v => ({ value: v, itemStyle: { color: v != null && v >= 0 ? COLORS[2] : COLORS[3] } })),
          itemStyle: { borderRadius: [3, 3, 0, 0] },
        }],
      },
      conclusion: `5 年里有 ${neg} 年自由现金流为负`,
    })
  }

  if (has('receivables') && has('revenue')) {
    const rGrowth = yoy(S.receivables)
    const revGrowth = yoy(S.revenue)
    charts.push({
      key: 'ar-growth',
      title: '应收增速与收入增速的缺口',
      read: '应收连续快于收入，等于用赊账换增长；缺口扩大两三年，收入质量就要打折',
      option: {
        tooltip: tooltip(), legend: legend(),
        grid: { left: 46, right: 24, top: 30, bottom: 26 },
        xAxis: baseAxis(years),
        yAxis: [valAxis('%')],
        series: [
          { name: '营业收入增速', type: 'line', data: revGrowth, symbolSize: 6, itemStyle: { color: COLORS[0] }, lineStyle: { width: 2 } },
          { name: '应收账款增速', type: 'line', data: rGrowth, symbolSize: 6, itemStyle: { color: COLORS[3] }, lineStyle: { width: 2 } },
        ],
      },
      conclusion: (() => {
        const a = rGrowth.filter(v => v != null).slice(-2)
        const b = revGrowth.filter(v => v != null).slice(-2)
        if (!a.length || !b.length) return '缺数据'
        const gap = a[a.length - 1] - b[b.length - 1]
        if (gap >= 0) return `最近一年应收增速高出收入 ${round(gap, 1)} 个百分点：增长靠赊账，收入质量要打折`
        return `最近一年应收增速低于收入 ${round(-gap, 1)} 个百分点：回款没有掉队`
      })(),
    })
  }

  if (has('grossMargin') && Array.isArray(I.grossMargin)) {
    charts.push({
      key: 'gm-industry',
      title: '毛利率相对同行：溢价还是折价',
      read: '稳定高于同行说明有定价权；忽高忽低要看是否靠一次性涨价或成本口径变化',
      option: {
        tooltip: tooltip(), legend: legend(),
        grid: { left: 46, right: 24, top: 30, bottom: 26 },
        xAxis: baseAxis(years),
        yAxis: [valAxis('%')],
        series: [
          { name: '本公司', type: 'line', data: S.grossMargin.map(num), symbolSize: 6, itemStyle: { color: COLORS[0] }, lineStyle: { width: 2.4 } },
          { name: '行业中位', type: 'line', data: I.grossMargin.map(num), symbolSize: 5, itemStyle: { color: IND }, lineStyle: { width: 1.6, type: 'dashed' } },
        ],
      },
      conclusion: (() => {
        const own = pickLast(S.grossMargin)
        const ind = pickLast(I.grossMargin)
        if (own == null || ind == null) return '缺数据'
        return `最新 ${round(own, 1)}%，比同行${own >= ind ? '高' : '低'} ${round(Math.abs(own - ind), 1)} 个百分点`
      })(),
    })
  }

  if (has('cash') && has('debt')) {
    const netCash = years.map((_, i) => {
      const c = num(S.cash[i])
      const d = num(S.debt[i])
      return c != null && d != null ? round(c - d, 1) : null
    })
    charts.push({
      key: 'cash-debt',
      title: '账上现金与有息负债',
      read: '净现金（现金−有息负债）转负且扩大，是"看着有钱其实欠着"的起点',
      option: {
        tooltip: tooltip(), legend: legend(),
        grid: { left: 52, right: 24, top: 30, bottom: 26 },
        xAxis: baseAxis(years),
        yAxis: [valAxis(unit)],
        series: [
          { name: '货币资金', type: 'bar', data: S.cash.map(num), itemStyle: { color: COLORS[2], borderRadius: [3, 3, 0, 0] } },
          { name: '有息负债', type: 'bar', data: S.debt.map(num), itemStyle: { color: COLORS[3], borderRadius: [3, 3, 0, 0] } },
          { name: '净现金', type: 'line', data: netCash, symbolSize: 5, itemStyle: { color: '#16181d' }, lineStyle: { width: 1.8 } },
        ],
      },
      conclusion: (() => {
        const v = pickLast(netCash)
        if (v == null) return '缺数据'
        return v >= 0 ? `最新净现金 ${round(v, 1)} ${unit}` : `最新净现金 ${round(v, 1)} ${unit}（净负债）`
      })(),
    })
  }

  if (has('debt') && has('totalAssets')) {
    const ratio = years.map((_, i) => {
      const d = num(S.debt[i])
      const a = num(S.totalAssets[i])
      return d != null && a ? round((d / a) * 100, 1) : null
    })
    const series = [{ name: '有息负债率', type: 'line', data: ratio, symbolSize: 6, itemStyle: { color: COLORS[0] }, lineStyle: { width: 2.4 } }]
    if (Array.isArray(I.debtRatio)) series.push({ name: '行业中位', type: 'line', data: I.debtRatio.map(num), symbolSize: 5, itemStyle: { color: IND }, lineStyle: { width: 1.6, type: 'dashed' } })
    charts.push({
      key: 'leverage',
      title: '杠杆放在什么位置',
      read: '有息负债率比同行高、同时自由现金流为负，是周期底最容易出事的组合',
      option: { tooltip: tooltip(), legend: legend(), grid: { left: 46, right: 24, top: 30, bottom: 26 }, xAxis: baseAxis(years), yAxis: [valAxis('%')], series },
      conclusion: `最新 ${round(pickLast(ratio), 1)}%`,
    })
  }

  if (has('inventory') && has('revenue') && has('grossMargin')) {
    const days = years.map((_, i) => {
      const inv = num(S.inventory[i])
      const rev = num(S.revenue[i])
      const gm = num(S.grossMargin[i])
      if (inv == null || rev == null || gm == null || rev === 0) return null
      const cogs = rev * (1 - gm / 100)
      return cogs > 0 ? Math.round((inv / cogs) * 365) : null
    })
    charts.push({
      key: 'inv-days',
      title: '存货天数：跌价风险攒了多久',
      read: '天数抬升+毛利率下滑=跌价准备在路上；一次大额计提后次年轻易"扭亏"',
      option: {
        tooltip: tooltip(),
        grid: { left: 46, right: 24, top: 26, bottom: 26 },
        xAxis: baseAxis(years),
        yAxis: [valAxis('天')],
        series: [{ name: '存货周转天数', type: 'line', data: days, symbolSize: 6, itemStyle: { color: COLORS[4] }, lineStyle: { width: 2.4 }, areaStyle: { opacity: 0.08 } }],
      },
      conclusion: (() => {
        const first = days.find(v => v != null)
        const last = pickLast(days)
        if (first == null || last == null) return '缺数据'
        return `从 ${first} 天变为 ${last} 天`
      })(),
    })
  }

  if (has('roe') || (has('netProfit') && has('equity'))) {
    const roe = has('roe')
      ? S.roe.map(num)
      : years.map((_, i) => {
        const np = num(S.netProfit[i])
        const eq = num(S.equity[i])
        return np != null && eq ? round((np / eq) * 100, 1) : null
      })
    charts.push({
      key: 'roe',
      title: 'ROE：股东的钱一年生多少利',
      read: '10% 是资本成本线附近；ROE 高要拆杜邦，看是利润率高、周转快还是杠杆高',
      option: {
        tooltip: tooltip(), legend: legend(),
        grid: { left: 46, right: 24, top: 30, bottom: 26 },
        xAxis: baseAxis(years),
        yAxis: [valAxis('%')],
        series: [
          { name: 'ROE', type: 'line', data: roe, symbolSize: 6, itemStyle: { color: COLORS[2] }, lineStyle: { width: 2.4 } },
          ...(Array.isArray(I.roe) ? [{ name: '行业中位', type: 'line', data: I.roe.map(num), symbolSize: 5, itemStyle: { color: IND }, lineStyle: { width: 1.6, type: 'dashed' } }] : []),
        ],
      },
      conclusion: (() => {
        const v = pickLast(roe)
        if (v == null) return '缺数据'
        return `${round(v, 1)}%，${v >= 10 ? '高于' : '低于'} 10% 资本成本线`
      })(),
    })
  }

  if (has('pe')) {
    const pe = S.pe.map(num)
    charts.push({
      key: 'pe',
      title: 'PE 五年带：现在处在自身历史的哪一档',
      read: '亏损年断点不连线；分位数比"贵不贵"这种形容词有用',
      option: {
        tooltip: tooltip(),
        grid: { left: 46, right: 24, top: 26, bottom: 26 },
        xAxis: baseAxis(years),
        yAxis: [valAxis('倍')],
        series: [{ name: 'PE(TTM)', type: 'line', data: pe, connectNulls: false, symbolSize: 6, itemStyle: { color: COLORS[1] }, lineStyle: { width: 2.4 }, areaStyle: { opacity: 0.08 } }],
      },
      conclusion: (() => {
        const v = pickLast(pe)
        const p = percentile(pe, v)
        return v == null ? '缺数据' : `最新 ${round(v, 1)} 倍，处于五年 ${p}% 分位`
      })(),
    })
  }

  if (has('pb')) {
    charts.push({
      key: 'pb',
      title: 'PB：市场给净资产的定价',
      read: 'PB 要与 ROE 一起看：高 PB 低 ROE 是估值透支，低 PB 高 ROE 才可能是错杀',
      option: {
        tooltip: tooltip(),
        grid: { left: 46, right: 24, top: 26, bottom: 26 },
        xAxis: baseAxis(years),
        yAxis: [valAxis('倍')],
        series: [{ name: 'PB', type: 'line', data: S.pb.map(num), connectNulls: false, symbolSize: 6, itemStyle: { color: COLORS[5] }, lineStyle: { width: 2.4 } }],
      },
      conclusion: `最新 ${round(pickLast(S.pb), 2)} 倍`,
    })
  }

  if (has('dividend') || has('buyback') || has('equityRaise')) {
    const parts = []
    if (has('dividend')) parts.push({ name: '现金分红', type: 'bar', stack: 'r', data: S.dividend.map(num), itemStyle: { color: COLORS[2] } })
    if (has('buyback')) parts.push({ name: '回购', type: 'bar', stack: 'r', data: S.buyback.map(num), itemStyle: { color: COLORS[0] } })
    if (has('equityRaise')) parts.push({ name: '股权融资', type: 'bar', stack: 'f', data: S.equityRaise.map(num), itemStyle: { color: COLORS[3] } })
    charts.push({
      key: 'payout',
      title: '钱是流向股东，还是从股东手里来',
      read: '分红+回购是回报，股权融资是索取；五年净额为正才算真回报',
      option: { tooltip: tooltip(), legend: legend(), grid: { left: 52, right: 24, top: 30, bottom: 26 }, xAxis: baseAxis(years), yAxis: [valAxis(unit)], series: parts },
      conclusion: (() => {
        const sum = arr => (Array.isArray(arr) ? arr.map(num).filter(v => v != null).reduce((a, b) => a + b, 0) : 0)
        const back = sum(S.dividend) + sum(S.buyback)
        const take = sum(S.equityRaise)
        return `五年回报 ${round(back, 1)}${unit}，融资 ${round(take, 1)}${unit}，净额 ${round(back - take, 1)}${unit}`
      })(),
    })
  }

  const Q = dataset.quarters
  if (Q && Array.isArray(Q.labels) && Q.labels.length && Array.isArray(Q.revenue)) {
    const axes = [valAxis(unit)]
    const series = [{ name: '季度营收', type: 'bar', data: Q.revenue.map(num), itemStyle: { color: COLORS[0], borderRadius: [3, 3, 0, 0] } }]
    if (Array.isArray(Q.grossMargin)) {
      series.push({ name: '毛利率(%)', type: 'line', yAxisIndex: 1, data: Q.grossMargin.map(num), symbolSize: 5, itemStyle: { color: COLORS[1] }, lineStyle: { width: 2 } })
      axes.push(valAxis('%', { position: 'right', splitLine: { show: false } }))
    }
    charts.push({
      key: 'quarterly',
      wide: true,
      title: '季度：拐点先出现在毛利率上',
      read: '收入还在增长但毛利率连续两季下滑，是周期见顶最早的一张图',
      option: { tooltip: tooltip(), legend: legend(), grid: { left: 52, right: 46, top: 30, bottom: 26 }, xAxis: { ...baseAxis(Q.labels), axisLabel: { color: '#8b94a3', fontSize: 10.5, rotate: 0 } }, yAxis: axes, series },
      conclusion: (() => {
        const gm = Array.isArray(Q.grossMargin) ? Q.grossMargin.map(num).filter(v => v != null) : []
        if (gm.length < 2) return '缺数据'
        const delta = gm[gm.length - 1] - gm[gm.length - 2]
        const dir = delta >= 0 ? '升' : '降'
        return `最近一季毛利率环比${dir} ${round(Math.abs(delta), 1)} 个百分点（${round(gm[gm.length - 2], 1)}% → ${round(gm[gm.length - 1], 1)}%）`
      })(),
    })
  }

  return charts
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

export function buildChartsHtml(dataset, { generatedAt = new Date().toISOString() } = {}) {
  const report = checkDataset(dataset)
  const charts = buildCharts(dataset)
  const S = dataset.series || {}
  const years = dataset.years || []
  const unit = dataset.unit || '亿元'
  const kpis = []
  const revCagr = cagr((S.revenue || []).map(num))
  kpis.push({ k: '营收 CAGR', v: revCagr == null ? '—' : `${round(revCagr, 1)}%`, d: `${years[0] || '—'}–${years[years.length - 1] || '—'}`, tone: revCagr == null ? '' : revCagr >= 10 ? 'good' : revCagr >= 0 ? '' : 'bad' })
  const np = pickLast(S.netProfit || [])
  const oc = pickLast(S.opCash || [])
  kpis.push({ k: '最新净现比', v: np && oc != null ? round(oc / np, 2) : '—', d: '经营现金流 ÷ 净利润', tone: np && oc != null ? (oc / np >= 1 ? 'good' : 'bad') : '' })
  const fcfSum = (S.opCash || []).map(num).reduce((acc, v, i) => {
    const cx = num((S.capex || [])[i])
    return v != null && cx != null ? acc + (v - cx) : acc
  }, 0)
  kpis.push({ k: '五年自由现金流', v: round(fcfSum, 1), d: '经营现金流 − 资本开支', tone: fcfSum >= 0 ? 'good' : 'bad' })
  const roeLast = pickLast(S.roe || [])
  kpis.push({ k: '最新 ROE', v: roeLast == null ? '—' : `${round(roeLast, 1)}%`, d: roeLast == null ? '缺数据' : roeLast >= 10 ? '高于 10% 资本成本' : '低于 10% 资本成本', tone: roeLast == null ? '' : roeLast >= 10 ? 'good' : 'bad' })

  const skipped = report.missing.map(m => m.label)
  const body = charts.map((c, i) => {
    const no = String(i + 1).padStart(2, '0')
    return `<article class="card${c.wide ? ' wide' : ''}">
  <div class="ct"><span class="no">${no}</span>${escapeHtml(c.title)}<span class="src">数据：${escapeHtml(unit)}</span></div>
  <div class="chart" id="ch-${c.key}" data-key="${c.key}"></div>
  <div class="read">读法：${escapeHtml(c.read)}</div>
  <div class="cc"><i class="dot"></i>${escapeHtml(c.conclusion)}</div>
</article>`
  }).join('\n')

  const stamp = new Date(generatedAt).toLocaleString('zh-CN', { hour12: false })
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(dataset.symbol || '')} ${escapeHtml(dataset.name || '')} · 财务图表概览</title>
<style>
:root{--txt:#16181d;--sub:#5b6472;--mute:#8b94a3;--line:#e6e9ef;--bg:#f5f6f8;--card:#fff;--self:#2563eb;--good:#16a34a;--warn:#d97706;--bad:#dc2626;--good-bg:#e8f5ec;--bad-bg:#fdeceb}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.65 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:1280px;margin:0 auto;padding:22px 26px 70px}
header{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 22px;padding-bottom:12px;border-bottom:1px solid var(--line)}
h1{font-size:23px;margin:0}
header .meta{color:var(--mute);font-size:12.5px;display:flex;flex-wrap:wrap;gap:12px}
header .meta b{color:var(--sub);font-weight:500}
.band{margin:14px 0 4px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:11px 14px}
.kpi .k{font-size:12px;color:var(--mute)}
.kpi .v{font-size:22px;font-weight:650}
.kpi .d{font-size:11.5px;color:var(--mute)}
.kpi.good .v{color:var(--good)} .kpi.bad .v{color:var(--bad)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px 10px;display:flex;flex-direction:column}
.card.wide{grid-column:1/-1}
.ct{font-size:13.5px;font-weight:600;display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.ct .no{font-size:11.5px;color:#fff;background:var(--self);border-radius:4px;padding:0 6px}
.ct .src{margin-left:auto;font-size:11.5px;color:var(--mute);font-weight:400}
.chart{height:240px;width:100%}
.card.wide .chart{height:290px}
.read{font-size:12px;color:var(--mute);margin:2px 2px 4px}
.cc{font-size:12.8px;color:var(--sub);display:flex;align-items:center;gap:7px;border-top:1px dashed var(--line);padding-top:7px}
.dot{width:7px;height:7px;border-radius:50%;background:var(--self);flex:none}
.note{margin-top:22px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;font-size:12.5px;color:var(--sub)}
.note b{color:var(--txt)}
.note ul{margin:6px 0 0;padding-left:18px}
footer{margin-top:26px;color:var(--mute);font-size:11.5px}
@media(max-width:820px){.grid,.band{grid-template-columns:1fr}.wrap{padding:16px}}
@media print{.card{break-inside:avoid}}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>${escapeHtml(dataset.name || dataset.symbol || '')} · 财务图表概览</h1>
  <div class="meta">
    <span><b>代码</b> ${escapeHtml(dataset.symbol || '—')}</span>
    <span><b>区间</b> ${escapeHtml(years[0] || '—')}–${escapeHtml(years[years.length - 1] || '—')}</span>
    <span><b>单位</b> ${escapeHtml(unit)}</span>
    <span><b>数据截止</b> ${escapeHtml(dataset.sourcedAt || '—')}</span>
    <span><b>生成</b> ${escapeHtml(stamp)}</span>
  </div>
</header>
<div class="band">
${kpis.map(k => `  <div class="kpi ${k.tone}"><div class="k">${escapeHtml(k.k)}</div><div class="v">${escapeHtml(String(k.v))}</div><div class="d">${escapeHtml(k.d)}</div></div>`).join('\n')}
</div>
<div class="grid">
${body}
</div>
<div class="note">
  <b>口径与边界</b>：数据来自公司定期报告与行情，未做任何估算填充；图上没有的数就是不掌握的数。
  ${skipped.length ? `<br><b>未覆盖</b>：${escapeHtml(skipped.join('、'))}——对应图已省略，需要时先补数据。` : ''}
  <br>图只描述"发生了什么"，不构成买卖建议；结论请落到 <b>stock_os verdict</b> 并附出处。
</div>
<footer>由 stock-os 生成 · 每张图只回答一个问题 · 缺数据不画预估线</footer>
</div>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<script>
const CH = ${JSON.stringify(charts.map(c => ({ key: c.key, option: c.option })))};
function boot(){
  if(!window.echarts){ document.querySelectorAll('.chart').forEach(el=>{ el.innerHTML='<div style="padding:16px;color:#8b94a3;font-size:12.5px;line-height:1.7">需要联网加载 ECharts 才能画图；下方读法与结论仍有效。</div>'; }); return; }
  CH.forEach(function(c){
    var el = document.querySelector('.chart[data-key="'+c.key+'"]');
    if(!el) return;
    try{
      var chart = echarts.init(el, null, {renderer:'canvas'});
      chart.setOption(c.option);
      window.addEventListener('resize', function(){ chart.resize(); });
    }catch(e){ el.innerHTML='<div style="padding:16px;color:#dc2626;font-size:12px">图表渲染失败：'+e.message+'</div>'; }
  });
}
if(document.readyState==='complete') boot(); else window.addEventListener('load', boot);
</script>
</body>
</html>`
}
