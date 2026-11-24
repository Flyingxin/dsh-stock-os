/**
 * Client half of dsh-stock-os.
 * Sidebar panellist entry + main page: dossiers / playbooks / journal.
 * Data comes from Host prefix /stock-os/api/* (see lib/api.js).
 */
window.__ModuleLoader__.load({
  id: 'dsh-stock-os',
  factory(require) {
    const React = require('react')
    const { useState, useEffect, useCallback, createElement: h, Fragment } = React

    const NS = 'stock-os'
    const PANEL_ID = 'stock-os'
    const API = '/stock-os'
    const NOTES_URL = '/stock-os/fin-notes.html'
    const STAGE_ORDER = ['idea', 'research', 'plan', 'open', 'hold', 'closed']
    const PLAYBOOK_ORDER = [
      'conductor', 'research', 'plan', 'entry', 'add', 'hold', 'reduce', 'exit', 'review',
    ]

    // Use only semantic --dsw-alias-* tokens so light/dark/system themes apply.
    const css = {
      page: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        colorScheme: 'light dark',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      },
      header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '16px 20px 10px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l1)',
      },
      title: { margin: 0, fontSize: 16, fontWeight: 650, letterSpacing: '0.01em' },
      sub: { margin: '4px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      tabs: { display: 'flex', gap: 6, padding: '10px 20px 0' },
      tab: (active) => ({
        appearance: 'none',
        border: '0.5px solid ' + (active
          ? 'var(--dsw-alias-border-l2)'
          : 'var(--dsw-alias-border-l1)'),
        background: active
          ? 'var(--dsw-alias-interactive-bg-active)'
          : 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 12,
        cursor: 'pointer',
      }),
      body: {
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '14px 20px 24px',
      },
      grid: {
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 320px) minmax(0, 1fr)',
        gap: 14,
        alignItems: 'start',
      },
      card: {
        border: '0.5px solid var(--dsw-alias-border-l1)',
        borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-1)',
        padding: 12,
        color: 'var(--dsw-alias-label-primary)',
      },
      cardActive: {
        borderColor: 'var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-interactive-bg-active)',
      },
      muted: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 },
      btn: {
        appearance: 'none',
        border: '0.5px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: 8,
        padding: '7px 11px',
        fontSize: 12,
        cursor: 'pointer',
      },
      btnPrimary: {
        appearance: 'none',
        border: 'none',
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-label-primary-foreground)',
        borderRadius: 8,
        padding: '7px 11px',
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: 600,
      },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        border: '0.5px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
      },
      chip: (tone) => ({
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 11,
        lineHeight: '16px',
        background: tone === 'good' ? 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent)'
          : tone === 'warn' ? 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent)'
            : tone === 'bad' ? 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent)'
              : 'var(--dsw-alias-interactive-bg-hover)',
        color: tone === 'good' ? 'var(--dsw-alias-state-success-primary)'
          : tone === 'warn' ? 'var(--dsw-alias-state-warn-primary)'
            : tone === 'bad' ? 'var(--dsw-alias-state-error-primary)'
              : 'var(--dsw-alias-label-secondary)',
      }),
      mono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: 'var(--dsw-alias-label-primary)',
      },
      stageRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
      },
      stageDot: (on, current) => ({
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 999,
        border: '0.5px solid ' + (current
          ? 'var(--dsw-alias-border-l2)'
          : 'var(--dsw-alias-border-l1)'),
        background: current
          ? 'var(--dsw-alias-interactive-bg-active)'
          : on
            ? 'var(--dsw-alias-interactive-bg-hover)'
            : 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        opacity: on || current ? 1 : 0.45,
      }),
      danger: { color: 'var(--dsw-alias-state-error-primary)' },
      success: { color: 'var(--dsw-alias-state-success-primary)' },
      warn: { color: 'var(--dsw-alias-state-warn-primary)' },
      mdWrap: {
        fontSize: 13,
        lineHeight: 1.65,
        color: 'var(--dsw-alias-label-primary)',
      },
    }

    const MD_CSS = `
.stock-os-md h1,.stock-os-md h2,.stock-os-md h3,.stock-os-md h4{
  margin:1.1em 0 .45em;font-weight:650;line-height:1.35;
  color:var(--dsw-alias-label-primary);
}
.stock-os-md h1{font-size:1.35em}.stock-os-md h2{font-size:1.18em}.stock-os-md h3{font-size:1.05em}
.stock-os-md p{margin:.55em 0}
.stock-os-md ul,.stock-os-md ol{margin:.45em 0;padding-left:1.35em}
.stock-os-md li{margin:.18em 0}
.stock-os-md hr{
  border:0;border-top:.5px solid var(--dsw-alias-border-l1);margin:1em 0;
}
.stock-os-md blockquote{
  margin:.65em 0;padding:.35em .85em;
  border-left:3px solid var(--dsw-alias-border-l2);
  color:var(--dsw-alias-label-secondary);
  background:var(--dsw-alias-bg-layer-2);
}
.stock-os-md code{
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:.92em;padding:.1em .35em;border-radius:4px;
  background:var(--dsw-alias-bg-layer-2);
}
.stock-os-md pre{
  margin:.65em 0;padding:10px 12px;border-radius:8px;overflow:auto;
  border:.5px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);
}
.stock-os-md pre code{padding:0;background:transparent}
.stock-os-md a{color:var(--dsw-alias-brand-primary);font-weight:500;text-decoration:none}
.stock-os-md a:hover{text-decoration:underline}
.stock-os-md .tbl{overflow:auto;margin:.65em 0}
.stock-os-md table{border-collapse:collapse;width:100%;font-size:12px}
.stock-os-md th,.stock-os-md td{
  border:.5px solid var(--dsw-alias-border-l1);padding:6px 8px;text-align:left;vertical-align:top;
}
.stock-os-md th{background:var(--dsw-alias-bg-layer-2);font-weight:650}
.stock-os-md strong{font-weight:650}
`

    const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]))

    function inlineMd(text) {
      return escHtml(text)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    }

    const isTableSep = (line) => /^\s*\|?[\s:-]*-[\s|:-]*$/.test(line) && line.includes('-') && line.includes('|')

    function renderMarkdown(md) {
      const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
      const out = []
      let i = 0
      while (i < lines.length) {
        const line = lines[i]
        if (/^\s*```/.test(line)) {
          const buf = []
          i++
          while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++])
          i++
          out.push('<pre><code>' + escHtml(buf.join('\n')) + '</code></pre>')
          continue
        }
        if (!line.trim()) { i++; continue }
        if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue }
        const heading = line.match(/^(#{1,6})\s+(.*)$/)
        if (heading) {
          const level = heading[1].length
          out.push('<h' + level + '>' + inlineMd(heading[2]) + '</h' + level + '>')
          i++
          continue
        }
        if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
          const cells = (l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim())
          const head = cells(line)
          i += 2
          const body = []
          while (i < lines.length && lines[i].includes('|') && lines[i].trim()) body.push(cells(lines[i++]))
          out.push(
            '<div class="tbl"><table><thead><tr>'
            + head.map((c) => '<th>' + inlineMd(c) + '</th>').join('')
            + '</tr></thead><tbody>'
            + body.map((r) => '<tr>' + r.map((c) => '<td>' + inlineMd(c) + '</td>').join('') + '</tr>').join('')
            + '</tbody></table></div>',
          )
          continue
        }
        if (/^\s*>\s?/.test(line)) {
          const buf = []
          while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''))
          out.push('<blockquote>' + buf.map(inlineMd).join('<br>') + '</blockquote>')
          continue
        }
        const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/)
        const ul = line.match(/^\s*[-*+]\s+(.*)$/)
        if (ol || ul) {
          const ordered = Boolean(ol)
          const buf = []
          while (i < lines.length) {
            const m = lines[i].match(ordered ? /^\s*(\d+)[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/)
            if (!m) break
            buf.push(m[ordered ? 2 : 1])
            i++
            while (
              i < lines.length
              && /^\s{2,}\S/.test(lines[i])
              && !/^\s*[-*+]\s/.test(lines[i])
            ) {
              buf[buf.length - 1] += ' ' + lines[i++].trim()
            }
          }
          const tag = ordered ? 'ol' : 'ul'
          out.push('<' + tag + '>' + buf.map((t) => '<li>' + inlineMd(t) + '</li>').join('') + '</' + tag + '>')
          continue
        }
        const buf = [line]
        i++
        while (
          i < lines.length
          && lines[i].trim()
          && !/^(#{1,6}\s|\s*[-*+]\s|\s*\d+[.)]\s|>|\s*```)/.test(lines[i])
          && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))
        ) {
          buf.push(lines[i++])
        }
        out.push('<p>' + buf.map(inlineMd).join('<br>') + '</p>')
      }
      return out.join('\n')
    }

    async function api(path, options) {
      const res = await fetch(API + path, {
        credentials: 'same-origin',
        headers: options && options.body
          ? { 'content-type': 'application/json' }
          : undefined,
        ...options,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status))
      return data
    }

    function verdictTone(status) {
      if (status === 'pass') return 'good'
      if (status === 'watch') return 'warn'
      if (status === 'fail' || status === 'suspect') return 'bad'
      return 'neutral'
    }

    function LedgerIcon({ size = 18, active }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          style: { opacity: active ? 1 : 0.72 },
          'aria-hidden': true,
        },
        h('rect', { x: 4, y: 3, width: 16, height: 18, rx: 2 }),
        h('path', { d: 'M8 8h8M8 12h8M8 16h5' }),
      )
    }

    function Section({ title, children, right }) {
      return h('section', { style: { ...css.card, marginBottom: 12 } }, [
        h('div', {
          key: 'h',
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            gap: 8,
          },
        }, [
          h('div', { key: 't', style: { fontSize: 13, fontWeight: 600 } }, title),
          right || null,
        ]),
        children,
      ])
    }

    function StagePipeline({ stage }) {
      const idx = STAGE_ORDER.indexOf(stage)
      return h('div', { style: css.stageRow },
        STAGE_ORDER.map((s, i) => h('span', {
          key: s,
          style: css.stageDot(i <= idx, s === stage),
        }, s)),
      )
    }

    function DossierList({ rows, selected, onSelect, onDelete, filter, onFilter }) {
      const q = (filter || '').trim().toUpperCase()
      const [confirming, setConfirming] = useState('')
      const filtered = !q ? rows : rows.filter((r) =>
        String(r.symbol || '').includes(q)
        || String(r.name || '').toUpperCase().includes(q)
        || String(r.stage || '').toUpperCase().includes(q))

      return h('div', null, [
        h('input', {
          key: 'search',
          style: { ...css.input, marginBottom: 10 },
          placeholder: '搜索代码 / 名称 / 阶段',
          value: filter,
          onChange: (e) => onFilter(e.target.value),
        }),
        filtered.length === 0
          ? h('div', { key: 'empty', style: css.muted }, '还没有档案。在下方输入代码开新对话，让 agent 从收集五年数据开始。')
          : filtered.map((r) => h('div', {
            key: r.symbol,
            role: 'button',
            tabIndex: 0,
            onClick: () => onSelect(r.symbol),
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(r.symbol)
              }
            },
            style: {
              ...css.card,
              ...(selected === r.symbol ? css.cardActive : null),
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              marginBottom: 8,
            },
          }, [
            h('div', {
              key: 'top',
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
            }, [
              h('strong', { key: 'sym', style: { fontSize: 13 } }, r.symbol),
              h('span', { key: 'acts', style: { display: 'flex', alignItems: 'center', gap: 6 } }, [
                h('span', { key: 'v', style: css.chip(verdictTone(r.verdict)) }, r.verdict || '未出'),
                h('button', {
                  key: 'del',
                  type: 'button',
                  title: confirming === r.symbol ? '再点一次确认删除' : '删除这份档案',
                  onClick: (e) => {
                    e.stopPropagation()
                    if (confirming === r.symbol) {
                      setConfirming('')
                      if (onDelete) onDelete(r.symbol)
                    } else {
                      setConfirming(r.symbol)
                    }
                  },
                  style: {
                    ...css.btn,
                    padding: '1px 8px',
                    fontSize: 11,
                    ...(confirming === r.symbol
                      ? { color: 'var(--dsw-alias-state-danger-primary)', borderColor: 'var(--dsw-alias-state-danger-primary)' }
                      : { color: 'var(--dsw-alias-label-secondary)' }),
                  },
                }, confirming === r.symbol ? '确认删除' : '删除'),
              ]),
            ]),
            h('div', { key: 'name', style: { ...css.muted, marginBottom: 6 } }, r.name || '未命名'),
            h('div', {
              key: 'meta',
              style: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 },
            }, [
              h('span', { key: 'st' }, '阶段 ' + r.stage),
              h('span', { key: 'pos', style: css.muted },
                r.qty > 0 ? (r.qty + ' 股 @ ' + r.avgCost) : '空仓'),
            ]),
          ])),
      ])
    }

    /**
     * Workspace navigation service. `ctx.get` bypasses the inject gate, so this
     * works even when the plugin was not declared with `uiWorkspace` injected;
     * the direct property read stays as a fallback for older clients.
     */
    function workspaceNav(ctx) {
      try {
        if (ctx && typeof ctx.get === 'function') {
          const service = ctx.get('uiWorkspace')
          if (service) return service
        }
      } catch {
        // not injected in this build — try the property below
      }
      try {
        if (ctx && ctx.uiWorkspace) return ctx.uiWorkspace
      } catch {
        // ignore
      }
      return null
    }

    function StartResearch({ ctx }) {
      const [symbol, setSymbol] = useState('')
      const [name, setName] = useState('')
      const [error, setError] = useState('')

      function open() {
        const sym = symbol.trim().toUpperCase()
        const who = sym ? sym + (name.trim() ? '（' + name.trim() + '）' : '') : '一只股票'
        const prompt = sym
          ? '调研 ' + who + '。先 stock_data 把近五年财报数据（营收 / 归母净利 / 经营现金流等）按年份写进去，用 action=check 确认通过；再用 stock_notes 检索判断依据、stock_charts 看趋势；然后按 stock_playbook stage=research 的清单给结论，用 stock_os verdict 写入。数据不齐就不要写结论。'
          : '我想开始调研一只股票：先问我代码、公司名、账户资金规模和关注点，然后按 stock_playbook stage=research 的流程，从 stock_data 收集近五年财报数据开始。'
        setError('')
        try {
          const nav = workspaceNav(ctx)
          if (nav && typeof nav.startSession === 'function') {
            nav.startSession(undefined, { prompt, whenDraftExists: 'replace' })
            return
          }
          throw new Error('当前客户端不支持直接新建会话，提示词已复制到剪贴板')
        } catch (err) {
          setError(err.message || String(err))
          try {
            if (navigator.clipboard) navigator.clipboard.writeText(prompt)
          } catch {
            // ignore
          }
        }
      }

      return h('div', { style: { display: 'grid', gap: 8 } }, [
        h('input', {
          key: 'symbol',
          style: css.input,
          placeholder: '代码，如 600519.SH（留空则先问）',
          value: symbol,
          onChange: (e) => setSymbol(e.target.value),
        }),
        h('input', {
          key: 'name',
          style: css.input,
          placeholder: '公司名（可选）',
          value: name,
          onChange: (e) => setName(e.target.value),
        }),
        h('div', { key: 'hint', style: css.muted },
          '会在新对话里附上调研提示词；档案由 agent 在调研阶段用 stock_os init 创建。'),
        error ? h('div', { key: 'err', style: { ...css.muted, ...css.danger } }, error) : null,
        h('button', {
          key: 'go',
          type: 'button',
          style: css.btnPrimary,
          onClick: open,
        }, '在新对话里开始调研'),
      ])
    }

    function DetailPanel({ symbol, onContinue }) {
      const [data, setData] = useState(null)
      const [error, setError] = useState('')
      const [price, setPrice] = useState('')
      const [guards, setGuards] = useState(null)
      const [busy, setBusy] = useState(false)
      const [report, setReport] = useState(null)
      const [reportErr, setReportErr] = useState('')
      const [preview, setPreview] = useState('')

      const load = useCallback(async () => {
        if (!symbol) return
        setError('')
        try {
          const result = await api('/api/dossier?symbol=' + encodeURIComponent(symbol))
          setData(result)
        } catch (err) {
          setError(err.message || String(err))
          setData(null)
        }
      }, [symbol])

      useEffect(() => { load() }, [load])

      async function runGuards() {
        setBusy(true)
        try {
          const q = new URLSearchParams({ symbol })
          if (price !== '') q.set('price', price)
          setGuards(await api('/api/guards?' + q.toString()))
        } catch (err) {
          setGuards({ ok: false, violations: [err.message || String(err)] })
        } finally {
          setBusy(false)
        }
      }

      async function runReport() {
        setBusy(true)
        setReportErr('')
        try {
          const result = await api('/api/report', {
            method: 'POST',
            body: JSON.stringify({ symbol }),
          })
          setReport(result)
          if (result.url) setPreview(result.url)
        } catch (err) {
          setReportErr(err.message || String(err))
        } finally {
          setBusy(false)
        }
      }

      if (!symbol) {
        return h('div', { style: { ...css.card, ...css.muted } }, '从左侧选择一只股票，或新建档案。')
      }
      if (error) return h('div', { style: { ...css.card, ...css.danger } }, error)
      if (!data) return h('div', { style: { ...css.card, ...css.muted } }, '加载中…')

      const d = data.dossier || {}
      const c = data.constitution
      const v = data.verdict
      const plans = data.plans

      return h(Fragment, null, [
        h(Section, {
          key: 'overview',
          title: (d.symbol || symbol) + (d.name ? ' · ' + d.name : ''),
          right: h('span', { style: { display: 'flex', gap: 6 } }, [
            h('button', {
              key: 'report',
              type: 'button',
              style: css.btn,
              disabled: busy,
              onClick: runReport,
            }, busy ? '生成中…' : '结论报告'),
            h('button', {
              key: 'continue',
              type: 'button',
              style: css.btnPrimary,
              title: d.sessionId
                ? '跳到写下这份档案的会话（' + String(d.sessionId).slice(0, 8) + '…）'
                : '这份档案没有记录来源会话，会新开一个对话',
              onClick: () => onContinue && onContinue(d),
            }, '在对话中继续'),
          ]),
        }, [
          h(StagePipeline, { key: 'pipe', stage: d.stage }),
          reportErr ? h('div', { key: 'rerr', style: { ...css.danger, marginTop: 8, fontSize: 12 } }, reportErr) : null,
          report && report.url
            ? h('div', { key: 'rlink', style: { marginTop: 8, fontSize: 12 } }, [
              h('a', {
                href: report.url,
                target: '_blank',
                rel: 'noopener',
                style: { color: 'var(--dsw-alias-brand-primary)' },
              }, '打开结论报告'),
              h('span', { style: { ...css.muted, marginLeft: 8 } },
                '结论 ' + (report.status || '—') + ' · 异常 ' + (report.failed == null ? '—' : report.failed) + ' 项'),
            ])
            : null,
          h('div', {
            key: 'meta',
            style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, fontSize: 12 },
          }, [
            h('span', { key: 'v', style: css.chip(verdictTone(d.verdict)) }, '结论 ' + (d.verdict || '未出')),
            h('span', { key: 'pos', style: css.chip(d.qty > 0 ? 'good' : 'neutral') },
              d.qty > 0 ? ('持仓 ' + d.qty + ' @ ' + d.avgCost) : '空仓'),
            d.reviewDueAt
              ? h('span', { key: 'due', style: css.chip('warn') }, '复盘 ' + String(d.reviewDueAt).slice(0, 10))
              : null,
          ]),
        ]),

        h(Section, { key: 'next', title: '下一步' },
          (data.nextActions || []).length
            ? h('ul', {
              style: { margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6 },
            }, data.nextActions.map((n, i) => h('li', { key: i }, n)))
            : h('div', { style: css.muted }, '暂无建议动作'),
        ),

        h(Section, { key: 'verdict', title: '买前结论' },
          v
            ? h('div', { style: { fontSize: 12, lineHeight: 1.55 } }, [
              h('div', { key: 's', style: { marginBottom: 6 } }, [
                h('span', { style: css.chip(verdictTone(v.status)) }, v.status),
                v.sourcedAt ? h('span', { style: { ...css.muted, marginLeft: 8 } }, '数据截止 ' + v.sourcedAt) : null,
              ]),
              h('div', { key: 'sum' }, v.summary || '（无摘要）'),
              (v.hardStops || []).length
                ? h('div', { key: 'hs', style: { marginTop: 8, ...css.danger } },
                  '硬排除：' + v.hardStops.join('；'))
                : null,
              (v.anomalies || []).length
                ? h('div', { key: 'an', style: { marginTop: 6, ...css.muted } },
                  '异常跟踪：' + v.anomalies.join('；'))
                : null,
            ])
            : h('div', { style: css.muted }, '尚未写入 verdict。先按 research 手册调研。'),
        ),

        h(Section, { key: 'constitution', title: '策略宪法' },
          c
            ? h('div', {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 8,
                fontSize: 12,
              },
            }, [
              ['仓位上限', c.maxPositionPct + '%'],
              ['分批', c.tranches],
              ['首笔', c.firstTranchePct + '%'],
              ['止损', c.stopLossPct + '%'],
              ['最大回撤', c.maxDrawdownPct + '%'],
              ['止盈', c.takeProfitPct + '%'],
              ['复盘周期', c.reviewCadenceDays + ' 天'],
            ].map(([k, val]) => h('div', {
              key: k,
              style: {
                border: '0.5px solid var(--dsw-alias-border-l1)',
                borderRadius: 8,
                padding: '8px 10px',
                background: 'var(--dsw-alias-bg-layer-2)',
              },
            }, [
              h('div', { key: 'k', style: css.muted }, k),
              h('div', { key: 'v', style: { marginTop: 2, fontWeight: 600 } }, String(val)),
            ])).concat([
              h('div', { key: 'add', style: { gridColumn: '1 / -1', ...css.muted } }, '加仓：' + (c.addRules || '—')),
              h('div', { key: 'reduce', style: { gridColumn: '1 / -1', ...css.muted } }, '减仓：' + (c.reduceRules || '—')),
              h('div', { key: 'exit', style: { gridColumn: '1 / -1', ...css.muted } },
                '退出信号：' + ((c.exitSignals || []).join('；') || '—')),
              h('div', { key: 'inv', style: { gridColumn: '1 / -1', ...css.muted } },
                '失效条件：' + ((c.invalidations || []).join('；') || '—')),
            ]))
            : h('div', { style: css.muted }, '尚未立宪法。没有宪法，交易工具会拒绝建仓。'),
        ),

        h(Section, { key: 'plans', title: '回撤预案' },
          plans && plans.drawdownPlan
            ? h('div', { style: { fontSize: 12, lineHeight: 1.55 } }, plans.drawdownPlan)
            : h('div', { style: css.muted }, '尚未写回撤预案。'),
        ),

        h(Section, { key: 'guards', title: '风控检查 (guards)' }, [
          h('div', {
            key: 'form',
            style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
          }, [
            h('input', {
              key: 'price',
              style: { ...css.input, maxWidth: 160 },
              type: 'number',
              step: 'any',
              placeholder: '现价（可选）',
              value: price,
              onChange: (e) => setPrice(e.target.value),
            }),
            h('button', {
              key: 'run',
              type: 'button',
              style: css.btn,
              disabled: busy,
              onClick: runGuards,
            }, busy ? '检查中…' : '跑规则'),
          ]),
          guards
            ? ((guards.violations || []).length
              ? h('ul', {
                key: 'v',
                style: { margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.55, ...css.warn },
              }, guards.violations.map((x, i) => h('li', { key: i }, x)))
              : h('div', { key: 'ok', style: { fontSize: 12, ...css.success } }, '规则检查通过'))
            : h('div', { key: 'hint', style: css.muted }, '动作前先让规则说话。'),
        ]),

        preview ? h('div', {
          key: 'preview',
          style: {
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          },
          onClick: (e) => { if (e.target === e.currentTarget) setPreview('') },
        }, [
          h('div', {
            key: 'panel',
            style: {
              width: 'min(1120px, 96vw)',
              height: '92vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--dsw-alias-bg-base)',
              border: '0.5px solid var(--dsw-alias-border-l1)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
            },
          }, [
            h('div', {
              key: 'bar',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 14px',
                borderBottom: '0.5px solid var(--dsw-alias-border-l1)',
              },
            }, [
              h('strong', { key: 't', style: { fontSize: 13 } }, '结论报告 · ' + symbol),
              h('div', { key: 'b', style: { display: 'flex', gap: 8 } }, [
                h('a', {
                  key: 'open',
                  href: preview,
                  target: '_blank',
                  rel: 'noopener',
                  style: { ...css.btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
                }, '新标签打开'),
                h('button', {
                  key: 'x',
                  type: 'button',
                  style: css.btn,
                  onClick: () => setPreview(''),
                }, '关闭'),
              ]),
            ]),
            h('iframe', {
              key: 'f',
              src: preview,
              title: '结论报告',
              style: { flex: 1, width: '100%', border: 0, background: '#fff' },
            }),
          ]),
        ]) : null,
      ])
    }

    function PlaybooksView() {
      const [stages, setStages] = useState([])
      const [active, setActive] = useState('conductor')
      const [text, setText] = useState('')
      const [mode, setMode] = useState('preview') // preview | source
      const [error, setError] = useState('')

      useEffect(() => {
        api('/api/playbooks')
          .then((d) => {
            setStages(d.stages || [])
            if (d.stages && d.stages[0]) setActive(d.stages[0].stage)
          })
          .catch((err) => setError(err.message || String(err)))
      }, [])

      useEffect(() => {
        if (!active) return
        setText('')
        api('/api/playbook?stage=' + encodeURIComponent(active))
          .then((d) => setText(d.text || ''))
          .catch((err) => setError(err.message || String(err)))
      }, [active])

      const ordered = PLAYBOOK_ORDER
        .map((s) => (stages.find((x) => x.stage === s) || { stage: s, title: s }))

      return h('div', { style: css.grid }, [
        h('style', { key: 'md-css' }, MD_CSS),
        h('div', { key: 'nav' }, ordered.map((s) => h('button', {
          key: s.stage,
          type: 'button',
          onClick: () => setActive(s.stage),
          style: {
            ...css.card,
            ...(active === s.stage ? css.cardActive : null),
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            marginBottom: 8,
            color: 'inherit',
          },
        }, [
          h('div', { key: 'id', style: { fontSize: 12, fontWeight: 650 } }, s.stage),
          h('div', { key: 't', style: { ...css.muted, marginTop: 4 } }, s.title),
        ]))),
        h('div', { key: 'body', style: css.card }, [
          h('div', {
            key: 'toolbar',
            style: {
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 6,
              marginBottom: 10,
            },
          }, [
            h('button', {
              key: 'preview',
              type: 'button',
              style: css.tab(mode === 'preview'),
              onClick: () => setMode('preview'),
            }, '预览'),
            h('button', {
              key: 'source',
              type: 'button',
              style: css.tab(mode === 'source'),
              onClick: () => setMode('source'),
            }, '源码'),
          ]),
          error ? h('div', { key: 'e', style: css.danger }, error) : null,
          !text
            ? h('div', { key: 'loading', style: css.muted }, '加载中…')
            : mode === 'source'
              ? h('pre', { key: 'src', style: { ...css.mono, margin: 0 } }, text)
              : h('div', {
                key: 'md',
                className: 'stock-os-md',
                style: css.mdWrap,
                dangerouslySetInnerHTML: { __html: renderMarkdown(text) },
              }),
        ]),
      ])
    }

    function JournalView({ symbolFilter }) {
      const [rows, setRows] = useState([])
      const [error, setError] = useState('')
      const [text, setText] = useState('')
      const [busy, setBusy] = useState(false)

      const load = useCallback(async () => {
        try {
          const q = new URLSearchParams({ limit: '120' })
          if (symbolFilter) q.set('symbol', symbolFilter)
          const data = await api('/api/journal?' + q.toString())
          setRows(data.rows || [])
          setError('')
        } catch (err) {
          setError(err.message || String(err))
        }
      }, [symbolFilter])

      useEffect(() => { load() }, [load])

      async function appendNote(e) {
        e.preventDefault()
        if (!text.trim()) return
        setBusy(true)
        try {
          await api('/api/journal', {
            method: 'POST',
            body: JSON.stringify({
              text: text.trim(),
              symbol: symbolFilter || undefined,
              kind: 'note',
            }),
          })
          setText('')
          await load()
        } catch (err) {
          setError(err.message || String(err))
        } finally {
          setBusy(false)
        }
      }

      return h('div', null, [
        h('form', {
          key: 'form',
          onSubmit: appendNote,
          style: { display: 'flex', gap: 8, marginBottom: 12 },
        }, [
          h('input', {
            key: 'text',
            style: css.input,
            placeholder: symbolFilter
              ? ('给 ' + symbolFilter + ' 追加一条流水备注')
              : '追加一条流水备注（可选关联当前档案）',
            value: text,
            onChange: (e) => setText(e.target.value),
          }),
          h('button', {
            key: 'go',
            type: 'submit',
            style: css.btnPrimary,
            disabled: busy,
          }, '记入'),
        ]),
        error ? h('div', { key: 'e', style: { ...css.danger, marginBottom: 8 } }, error) : null,
        rows.length === 0
          ? h('div', { key: 'empty', style: { ...css.card, ...css.muted } }, '还没有流水。')
          : rows.map((r, i) => h('div', {
            key: String(r.ts) + '-' + i,
            style: { ...css.card, marginBottom: 8 },
          }, [
            h('div', {
              key: 'top',
              style: { display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
            }, [
              h('span', { key: 'a', style: { fontSize: 12, fontWeight: 650 } },
                [r.action, r.trade, r.symbol].filter(Boolean).join(' · ') || 'note'),
              h('span', { key: 't', style: css.muted },
                r.ts ? String(r.ts).replace('T', ' ').slice(0, 19) : ''),
            ]),
            h('div', { key: 'reason', style: { fontSize: 12, lineHeight: 1.5 } },
              r.reason || r.text || JSON.stringify(r)),
          ])),
      ])
    }

    function LedgerPage({ ctx }) {
      const [tab, setTab] = useState('dossiers')
      const [rows, setRows] = useState([])
      const [stats, setStats] = useState({ holding: 0, byStage: {} })
      const [dir, setDir] = useState('')
      const [selected, setSelected] = useState('')
      const [filter, setFilter] = useState('')
      const [error, setError] = useState('')
      const t = ctx.locale.bind(NS)

      const refresh = useCallback(async () => {
        try {
          const data = await api('/api/list')
          setRows(data.rows || [])
          setStats(data.stats || { holding: 0, byStage: {} })
          setDir(data.dir || '')
          setError('')
          if (!selected && data.rows && data.rows[0]) setSelected(data.rows[0].symbol)
        } catch (err) {
          setError(err.message || String(err))
        }
      }, [selected])

      useEffect(() => { refresh() }, [])

      function continueInChat(dossier) {
        const symbol = dossier && dossier.symbol
        if (!symbol) return
        const prompt = '打开 ' + symbol + (dossier.name ? '（' + dossier.name + '）' : '')
          + ' 的投资决策账本：先 stock_os action=get，再按当前阶段读 stock_playbook，告诉我下一步该做什么。'
        const nav = workspaceNav(ctx)
        if (dossier.sessionId && nav && typeof nav.openSession === 'function') {
          try {
            nav.openSession(dossier.sessionId)
            return
          } catch {
            // 会话可能已被删除，退回新开一个
          }
        }
        try {
          if (nav && typeof nav.startSession === 'function') {
            nav.startSession(undefined, { prompt, whenDraftExists: 'replace' })
            return
          }
        } catch {
          // fall through
        }
        try {
          if (navigator.clipboard) navigator.clipboard.writeText(prompt)
        } catch {
          // ignore
        }
      }

      async function removeDossier(symbol) {
        try {
          await api('/api/delete', {
            method: 'POST',
            body: JSON.stringify({ symbol }),
          })
          if (selected === symbol) setSelected('')
          await refresh()
        } catch (err) {
          setError(err.message || String(err))
        }
      }

      return h('div', { style: css.page }, [
        h('header', { key: 'header', style: css.header }, [
          h('div', { key: 'left' }, [
            h('h1', { key: 't', style: css.title }, t('title')),
            h('p', { key: 's', style: css.sub },
              t('subtitle') + (dir ? ' · ' + dir : '')),
          ]),
          h('div', { key: 'right', style: { display: 'flex', gap: 8 } }, [
            h('span', { key: 'stat', style: css.chip('neutral') },
              (rows.length || 0) + ' 档案 · ' + (stats.holding || 0) + ' 持仓'),
            h('button', {
              key: 'refresh',
              type: 'button',
              style: css.btn,
              onClick: refresh,
            }, t('refresh')),
          ]),
        ]),
        h('div', { key: 'tabs', style: css.tabs }, [
          ['dossiers', t('tabDossiers')],
          ['playbooks', t('tabPlaybooks')],
          ['prompts', t('tabPrompts')],
          ['journal', t('tabJournal')],
          ['notes', t('tabNotes')],
        ].map(([id, label]) => h('button', {
          key: id,
          type: 'button',
          style: css.tab(tab === id),
          onClick: () => setTab(id),
        }, label))),
        h('div', {
          key: 'body',
          style: tab === 'notes'
            ? { ...css.body, padding: '0 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
            : css.body,
        }, [
          error ? h('div', {
            key: 'err',
            style: { ...css.card, ...css.danger, marginBottom: 12 },
          }, error) : null,
          tab === 'dossiers' ? h('div', { key: 'd', style: css.grid }, [
            h('div', { key: 'left' }, [
              h(DossierList, {
                key: 'list',
                rows,
                selected,
                onSelect: setSelected,
                onDelete: removeDossier,
                filter,
                onFilter: setFilter,
              }),
              h('div', { key: 'init', style: { ...css.card, marginTop: 8 } }, [
                h('div', { key: 'h', style: { fontSize: 13, fontWeight: 600, marginBottom: 8 } },
                  t('newDossier')),
                h(StartResearch, {
                  key: 'form',
                  ctx,
                }),
              ]),
            ]),
            h('div', { key: 'right' }, h(DetailPanel, {
              symbol: selected,
              onContinue: continueInChat,
            })),
          ]) : null,
          tab === 'playbooks' ? h(PlaybooksView, { key: 'pb' }) : null,
          tab === 'prompts' ? h(PromptsView, { key: 'pr' }) : null,
          tab === 'journal' ? h(JournalView, { key: 'j', symbolFilter: selected || '' }) : null,
          tab === 'notes' ? h(NotesView, { key: 'notes' }) : null,
        ]),
      ])
    }

    function PromptsView() {
      const [stages, setStages] = useState([])
      const [hint, setHint] = useState('')
      const [error, setError] = useState('')
      const [copied, setCopied] = useState('')

      useEffect(() => {
        api('/api/prompts')
          .then((d) => {
            setStages(d.stages || [])
            setHint(d.hint || '')
          })
          .catch((err) => setError(err.message || String(err)))
      }, [])

      function copy(id, text) {
        try {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text)
            setCopied(id)
            setTimeout(() => setCopied(''), 1500)
          }
        } catch {
          // ignore
        }
      }

      if (error) return h('div', { style: { ...css.card, ...css.danger } }, error)

      return h('div', null, [
        h('div', { key: 'intro', style: { ...css.card, marginBottom: 12 } }, [
          h('div', { key: 't', style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, '每个阶段怎么往下走'),
          h('div', { key: 'd', style: { ...css.muted, lineHeight: 1.6 } },
            '按当前阶段挑一句，把代码换成你的股票再发出去。' + (hint ? ' ' + hint : '')),
          h('div', { key: 'n', style: { ...css.muted, marginTop: 6 } },
            '规则：数据没通过 stock_data check 之前不要写 verdict；没有宪法不要建仓；每次动作都要留流水。'),
        ]),
        stages.map((s) => h('section', { key: s.stage, style: { ...css.card, marginBottom: 10 } }, [
          h('div', {
            key: 'h',
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 },
          }, [
            h('div', { key: 'l', style: { fontSize: 13, fontWeight: 600 } }, s.label),
            h('div', { key: 'w', style: css.muted }, s.when),
          ]),
          ...(s.prompts || []).map((p, i) => h('div', {
            key: 'p' + i,
            style: { borderTop: '0.5px solid var(--dsw-alias-border-l1)', padding: '10px 0' },
          }, [
            h('div', {
              key: 'pt',
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
            }, [
              h('span', { key: 'x', style: { fontSize: 12, fontWeight: 600 } }, p.title),
              h('button', {
                key: 'c',
                type: 'button',
                style: { ...css.btn, padding: '2px 9px', fontSize: 11 },
                onClick: () => copy(s.stage + i, p.text),
              }, copied === s.stage + i ? '已复制' : '复制'),
            ]),
            h('div', { key: 'tx', style: { fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre-wrap' } }, p.text),
          ])),
        ])),
      ])
    }

    function NotesView() {
      return h('div', {
        style: {
          flex: 1,
          minHeight: 0,
          height: '100%',
          overflow: 'hidden',
          background: 'var(--dsw-alias-bg-base)',
        },
      }, h('iframe', {
        title: '财报分析笔记',
        src: NOTES_URL,
        style: {
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
          background: 'transparent',
        },
      }))
    }

    if (typeof window !== 'undefined' && typeof window.__STOCK_OS_TEST__ === 'function') {
      window.__STOCK_OS_TEST__({ LedgerPage, DetailPanel, DossierList, StartResearch, PromptsView })
    }

    return {
      inject: ['slots', 'locale'],

      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, {
          zh: {
            panel: '投资账本',
            title: '投资决策账本',
            subtitle: '先有规则，再有动作；每笔留痕',
            refresh: '刷新',
            tabDossiers: '档案',
            tabPlaybooks: '手册',
            tabPrompts: '提示词',
            tabJournal: '流水',
            tabNotes: '财报笔记',
            newDossier: '新建档案',
          },
          en: {
            panel: 'Ledger',
            title: 'Investment decision ledger',
            subtitle: 'Rules before trades; one record per action',
            refresh: 'Refresh',
            tabDossiers: 'Dossiers',
            tabPlaybooks: 'Playbooks',
            tabPrompts: 'Prompts',
            tabJournal: 'Journal',
            tabNotes: 'Fin. notes',
            newDossier: 'New dossier',
          },
        }), 'stock-os: dictionaries')

        const t = ctx.locale.bind(NS)

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 24,
            locale: NS,
            label: () => t('panel'),
          }, LedgerIcon),
        )

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            { name: 'main', key: PANEL_ID, locale: NS },
            () => h(LedgerPage, { ctx }),
          ),
        )
      },
    }
  },
})
