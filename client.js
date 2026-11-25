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
    const STAGE_LABEL = {
      idea: '立项',
      research: '买前调研',
      plan: '立宪法',
      open: '建仓',
      hold: '持有',
      closed: '已清仓',
    }
    const PLAYBOOK_ORDER = [
      'conductor', 'research', 'plan', 'entry', 'add', 'hold', 'reduce', 'exit', 'review',
    ]
    const PLAYBOOK_LABEL = {
      conductor: '总纲',
      research: '买前调研',
      plan: '策略宪法',
      entry: '建仓',
      add: '加仓',
      hold: '持有',
      reduce: '减仓',
      exit: '清仓',
      review: '复盘',
    }
    const READY_LABEL = {
      dataset: '五年数据',
      verdict: '买前结论',
      constitution: '策略宪法',
      drawdownPlan: '回撤预案',
      review: '复盘',
    }

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
        padding: '18px 22px 12px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l1)',
      },
      title: { margin: 0, fontSize: 17, fontWeight: 650, letterSpacing: '0.01em' },
      sub: { margin: '4px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      tabs: {
        display: 'flex',
        gap: 2,
        padding: '0 22px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l1)',
      },
      tab: (active) => ({
        appearance: 'none',
        border: 'none',
        borderBottom: active
          ? '2px solid var(--dsw-alias-brand-primary)'
          : '2px solid transparent',
        background: 'transparent',
        color: active
          ? 'var(--dsw-alias-label-primary)'
          : 'var(--dsw-alias-label-secondary)',
        borderRadius: 0,
        padding: '10px 14px 8px',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
      }),
      body: {
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '16px 22px 28px',
      },
      grid: {
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)',
        gap: 16,
        alignItems: 'start',
      },
      card: {
        border: '0.5px solid var(--dsw-alias-border-l1)',
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-layer-1)',
        padding: 14,
        color: 'var(--dsw-alias-label-primary)',
      },
      cardActive: {
        borderColor: 'var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-interactive-bg-active)',
      },
      hero: {
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-1)',
        padding: '16px 18px',
        marginBottom: 14,
      },
      muted: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 },
      bodyText: { fontSize: 13, lineHeight: 1.55, color: 'var(--dsw-alias-label-primary)' },
      btn: {
        appearance: 'none',
        border: '0.5px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: 8,
        padding: '7px 12px',
        fontSize: 12,
        cursor: 'pointer',
      },
      btnPrimary: {
        appearance: 'none',
        border: 'none',
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-label-primary-foreground)',
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 13,
        cursor: 'pointer',
        fontWeight: 600,
      },
      btnGhost: {
        appearance: 'none',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        cursor: 'pointer',
      },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        border: '0.5px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
      },
      chip: (tone) => ({
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        lineHeight: '16px',
        fontWeight: 500,
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
        alignItems: 'center',
        gap: 4,
        marginTop: 10,
      },
      stageDot: (on, current) => ({
        fontSize: 11,
        padding: '4px 9px',
        borderRadius: 6,
        border: '0.5px solid ' + (current
          ? 'var(--dsw-alias-border-l2)'
          : 'transparent'),
        background: current
          ? 'var(--dsw-alias-interactive-bg-active)'
          : on
            ? 'var(--dsw-alias-bg-layer-2)'
            : 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        opacity: current ? 1 : on ? 0.72 : 0.38,
        fontWeight: current ? 650 : 500,
      }),
      readyGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gap: 6,
        marginTop: 12,
      },
      readyCell: (ok, warn) => ({
        border: '0.5px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        padding: '8px 6px',
        textAlign: 'center',
        background: ok
          ? 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)'
          : warn
            ? 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent)'
            : 'var(--dsw-alias-bg-layer-2)',
        fontSize: 11,
        lineHeight: 1.35,
      }),
      danger: { color: 'var(--dsw-alias-state-error-primary)' },
      success: { color: 'var(--dsw-alias-state-success-primary)' },
      warn: { color: 'var(--dsw-alias-state-warn-primary)' },
      mdWrap: {
        fontSize: 13,
        lineHeight: 1.65,
        color: 'var(--dsw-alias-label-primary)',
      },
      empty: {
        border: '0.5px dashed var(--dsw-alias-border-l1)',
        borderRadius: 12,
        padding: '28px 20px',
        textAlign: 'center',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 13,
        lineHeight: 1.55,
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
          title: s,
        }, STAGE_LABEL[s] || s)),
      )
    }

    function ReadinessRow({ readiness, onJump }) {
      if (!readiness) return null
      const cells = [
        { key: 'dataset', ok: readiness.dataset },
        { key: 'verdict', ok: readiness.verdict },
        { key: 'constitution', ok: readiness.constitution },
        { key: 'drawdownPlan', ok: readiness.drawdownPlan },
        {
          key: 'review',
          ok: readiness.hasReview || (readiness.reviewDueAt && !readiness.reviewOverdue),
          warn: readiness.reviewOverdue,
        },
      ]
      return h('div', { style: css.readyGrid }, cells.map((c) => h('button', {
        key: c.key,
        type: 'button',
        style: {
          ...css.readyCell(c.ok, c.warn),
          cursor: onJump ? 'pointer' : 'default',
          color: 'inherit',
        },
        onClick: () => onJump && onJump(c.key),
        title: READY_LABEL[c.key],
      }, [
        h('div', { key: 'm', style: { fontWeight: 650, marginBottom: 2 } },
          c.warn ? '!' : (c.ok ? '✓' : '·')),
        h('div', { key: 'l', style: css.muted }, READY_LABEL[c.key]),
      ])))
    }

    function DossierList({ rows, selected, onSelect, onDelete, filter, onFilter }) {
      const q = (filter || '').trim().toUpperCase()
      const [confirming, setConfirming] = useState('')
      const [hover, setHover] = useState('')
      const filtered = !q ? rows : rows.filter((r) =>
        String(r.symbol || '').includes(q)
        || String(r.name || '').toUpperCase().includes(q)
        || String(STAGE_LABEL[r.stage] || r.stage || '').toUpperCase().includes(q)
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
          ? h('div', { key: 'empty', style: css.empty },
            '还没有档案。在下方开始调研，agent 会从五年数据写起。')
          : filtered.map((r) => h('div', {
            key: r.symbol,
            role: 'button',
            tabIndex: 0,
            onClick: () => onSelect(r.symbol),
            onMouseEnter: () => setHover(r.symbol),
            onMouseLeave: () => setHover(''),
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
              padding: '12px 12px 10px',
            },
          }, [
            h('div', {
              key: 'top',
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
            }, [
              h('strong', { key: 'sym', style: { fontSize: 13 } }, r.symbol),
              h('span', { key: 'acts', style: { display: 'flex', alignItems: 'center', gap: 4 } }, [
                h('span', { key: 'v', style: css.chip(verdictTone(r.verdict)) }, r.verdict || '未出'),
                (hover === r.symbol || confirming === r.symbol || selected === r.symbol)
                  ? h('button', {
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
                      ...css.btnGhost,
                      ...(confirming === r.symbol
                        ? { color: 'var(--dsw-alias-state-error-primary)', fontWeight: 600 }
                        : null),
                    },
                  }, confirming === r.symbol ? '确认删' : '删')
                  : null,
              ]),
            ]),
            h('div', { key: 'name', style: { ...css.muted, marginBottom: 6 } }, r.name || '未命名'),
            h('div', {
              key: 'meta',
              style: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 },
            }, [
              h('span', { key: 'st', style: { fontWeight: 550 } }, STAGE_LABEL[r.stage] || r.stage),
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
          ? '调研 ' + who + '。先 stock_os init（若尚无档案），再 stock_next 看下一步；从 stock_data 写入近五年财报并用 check 确认通过，再用 stock_notes / stock_charts，最后按 research 手册写 stock_os verdict。数据不齐就不要写结论。'
          : '我想开始调研一只股票：先问我代码、公司名、账户资金规模和关注点，然后 stock_status / stock_next，从 stock_data 收集近五年财报数据开始。'
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

    function DetailPanel({ symbol, onContinue, onOpenPlaybook, onOpenPrompts }) {
      const [data, setData] = useState(null)
      const [guidance, setGuidance] = useState(null)
      const [error, setError] = useState('')
      const [price, setPrice] = useState('')
      const [guards, setGuards] = useState(null)
      const [busy, setBusy] = useState(false)
      const [report, setReport] = useState(null)
      const [reportErr, setReportErr] = useState('')
      const [preview, setPreview] = useState('')
      const [copied, setCopied] = useState(false)
      const [rulesOpen, setRulesOpen] = useState(false)
      const holdingStage = data && data.dossier
        && (data.dossier.stage === 'hold' || data.dossier.stage === 'open')

      const load = useCallback(async () => {
        if (!symbol) return
        setError('')
        setGuards(null)
        setReport(null)
        try {
          const [dossier, next] = await Promise.all([
            api('/api/dossier?symbol=' + encodeURIComponent(symbol)),
            api('/api/next?symbol=' + encodeURIComponent(symbol)).catch(() => null),
          ])
          setData(dossier)
          setGuidance(next || (dossier.guidance
            ? { ...dossier, next: dossier.guidance.next, readiness: dossier.guidance.readiness, blockers: dossier.guidance.blockers, chatPrompt: dossier.guidance.next && dossier.guidance.next.chatPrompt }
            : null))
        } catch (err) {
          setError(err.message || String(err))
          setData(null)
          setGuidance(null)
        }
      }, [symbol])

      useEffect(() => { load() }, [load])

      async function runGuards() {
        setBusy(true)
        try {
          const q = new URLSearchParams({ symbol })
          if (price !== '') q.set('price', price)
          setGuards(await api('/api/guards?' + q.toString()))
          if (price !== '') {
            const next = await api('/api/next?symbol=' + encodeURIComponent(symbol)
              + '&price=' + encodeURIComponent(price)).catch(() => null)
            if (next) setGuidance(next)
          }
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

      function chatPromptText() {
        const n = guidance && guidance.next
        if (n && n.chatPrompt) return n.chatPrompt
        const d = (data && data.dossier) || {}
        return '打开 ' + symbol + (d.name ? '（' + d.name + '）' : '')
          + '：先 stock_next，再按返回的手册与建议调用推进。'
      }

      function copyPrompt() {
        try {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(chatPromptText())
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }
        } catch {
          // ignore
        }
      }

      function jumpReady(key) {
        const map = {
          dataset: 'research',
          verdict: 'research',
          constitution: 'plan',
          drawdownPlan: 'plan',
          review: 'review',
        }
        if (onOpenPlaybook) onOpenPlaybook(map[key] || 'conductor')
      }

      if (!symbol) {
        return h('div', { style: css.empty }, [
          h('div', { key: 't', style: { fontWeight: 600, marginBottom: 6, color: 'var(--dsw-alias-label-primary)' } },
            '选择一只股票'),
          h('div', { key: 'd' }, '从左侧点开档案，或开始调研。面板只看状态；买卖与改规则仍在对话里完成。'),
        ])
      }
      if (error) return h('div', { style: { ...css.card, ...css.danger } }, error)
      if (!data) return h('div', { style: { ...css.card, ...css.muted } }, '加载中…')

      const d = data.dossier || {}
      const c = data.constitution
      const v = data.verdict
      const plans = data.plans
      const next = (guidance && guidance.next) || (data.guidance && data.guidance.next) || null
      const readiness = (guidance && guidance.readiness)
        || (data.guidance && data.guidance.readiness)
        || null
      const blockers = (guidance && guidance.blockers)
        || (data.guidance && data.guidance.blockers)
        || []

      const guardsBlock = h(Section, {
        key: 'guards',
        title: '风控检查',
        right: holdingStage
          ? h('span', { style: css.chip('warn') }, '持有期优先')
          : null,
      }, [
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
              style: { margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, ...css.warn },
            }, guards.violations.map((x, i) => h('li', { key: i }, x)))
            : h('div', { key: 'ok', style: { fontSize: 13, ...css.success } }, '规则检查通过'))
          : h('div', { key: 'hint', style: css.muted }, '动作前先让规则说话。'),
      ])

      return h(Fragment, null, [
        h('div', { key: 'hero', style: css.hero }, [
          h('div', {
            key: 'head',
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
          }, [
            h('div', { key: 'left' }, [
              h('div', { key: 'title', style: { fontSize: 16, fontWeight: 650 } },
                (d.symbol || symbol) + (d.name ? ' · ' + d.name : '')),
              h('div', {
                key: 'meta',
                style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
              }, [
                h('span', { key: 'st', style: css.chip('neutral') },
                  STAGE_LABEL[d.stage] || d.stage),
                h('span', { key: 'v', style: css.chip(verdictTone(d.verdict)) },
                  '结论 ' + (d.verdict || '未出')),
                h('span', { key: 'pos', style: css.chip(d.qty > 0 ? 'good' : 'neutral') },
                  d.qty > 0 ? ('持仓 ' + d.qty + ' @ ' + d.avgCost) : '空仓'),
                d.reviewDueAt
                  ? h('span', { key: 'due', style: css.chip('warn') },
                    '复盘 ' + String(d.reviewDueAt).slice(0, 10))
                  : null,
              ]),
            ]),
            h('div', { key: 'acts', style: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' } }, [
              h('button', {
                key: 'report',
                type: 'button',
                style: css.btn,
                disabled: busy,
                onClick: runReport,
              }, busy ? '生成中…' : '结论报告'),
              h('button', {
                key: 'copy',
                type: 'button',
                style: css.btn,
                onClick: copyPrompt,
              }, copied ? '已复制' : '复制提示词'),
              h('button', {
                key: 'continue',
                type: 'button',
                style: css.btnPrimary,
                title: d.sessionId
                  ? '跳到写下这份档案的会话'
                  : '新开对话并附上下一步提示词',
                onClick: () => onContinue && onContinue(d, chatPromptText()),
              }, '按此继续对话'),
            ]),
          ]),
          h(StagePipeline, { key: 'pipe', stage: d.stage }),
          next
            ? h('div', {
              key: 'next',
              style: {
                marginTop: 14,
                paddingTop: 12,
                borderTop: '0.5px solid var(--dsw-alias-border-l1)',
              },
            }, [
              h('div', { key: 'eyebrow', style: { ...css.muted, marginBottom: 4 } },
                '下一步' + (next.playbook ? ' · 手册 ' + (PLAYBOOK_LABEL[next.playbook] || next.playbook) : '')),
              h('div', { key: 'nt', style: { fontSize: 15, fontWeight: 650, marginBottom: 4 } }, next.title),
              h('div', { key: 'why', style: css.bodyText }, next.why || ''),
              blockers.length
                ? h('ul', {
                  key: 'blk',
                  style: { margin: '8px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.5, ...css.warn },
                }, blockers.map((b, i) => h('li', { key: i }, b.message || b)))
                : null,
            ])
            : null,
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
        ]),

        readiness
          ? h('div', { key: 'ready', style: { ...css.card, marginBottom: 14 } }, [
            h('div', { key: 'h', style: { fontSize: 13, fontWeight: 600, marginBottom: 4 } }, '就绪度'),
            h('div', { key: 'hint', style: { ...css.muted, marginBottom: 4 } },
              '点缺失项可跳到对应手册'),
            h(ReadinessRow, { key: 'row', readiness, onJump: jumpReady }),
          ])
          : null,

        holdingStage ? guardsBlock : null,

        h(Section, { key: 'verdict', title: '买前结论' },
          v
            ? h('div', { style: css.bodyText }, [
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
            : h('div', { style: css.muted }, '尚未写入结论。点上方「按此继续对话」从调研开始。'),
        ),

        h(Section, {
          key: 'constitution',
          title: '策略宪法',
          right: c
            ? h('button', {
              type: 'button',
              style: css.btnGhost,
              onClick: () => setRulesOpen(!rulesOpen),
            }, rulesOpen ? '收起规则' : '展开规则')
            : null,
        },
          c
            ? h('div', null, [
              h('div', {
                key: 'nums',
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                  gap: 0,
                  borderTop: '0.5px solid var(--dsw-alias-border-l1)',
                  borderLeft: '0.5px solid var(--dsw-alias-border-l1)',
                  fontSize: 12,
                },
              }, [
                ['仓位上限', c.maxPositionPct + '%'],
                ['分批', c.tranches],
                ['首笔', c.firstTranchePct + '%'],
                ['止损', c.stopLossPct + '%'],
                ['最大回撤', c.maxDrawdownPct + '%'],
                ['止盈', c.takeProfitPct + '%'],
                ['复盘', c.reviewCadenceDays + ' 天'],
              ].map(([k, val]) => h('div', {
                key: k,
                style: {
                  padding: '10px 10px',
                  borderRight: '0.5px solid var(--dsw-alias-border-l1)',
                  borderBottom: '0.5px solid var(--dsw-alias-border-l1)',
                },
              }, [
                h('div', { key: 'k', style: css.muted }, k),
                h('div', { key: 'v', style: { marginTop: 2, fontWeight: 650, fontSize: 13 } }, String(val)),
              ]))),
              rulesOpen
                ? h('div', { key: 'rules', style: { marginTop: 10, ...css.muted, lineHeight: 1.55 } }, [
                  h('div', { key: 'add' }, '加仓：' + (c.addRules || '—')),
                  h('div', { key: 'reduce', style: { marginTop: 4 } }, '减仓：' + (c.reduceRules || '—')),
                  h('div', { key: 'exit', style: { marginTop: 4 } },
                    '退出：' + ((c.exitSignals || []).join('；') || '—')),
                  h('div', { key: 'inv', style: { marginTop: 4 } },
                    '失效：' + ((c.invalidations || []).join('；') || '—')),
                ])
                : null,
              plans && plans.drawdownPlan
                ? h('div', {
                  key: 'dd',
                  style: { marginTop: 10, fontSize: 13, lineHeight: 1.55 },
                }, [
                  h('div', { key: 'l', style: { ...css.muted, marginBottom: 4 } }, '回撤预案'),
                  h('div', { key: 't' }, plans.drawdownPlan),
                ])
                : h('div', { key: 'nodd', style: { ...css.muted, marginTop: 8 } }, '尚未写回撤预案。'),
            ])
            : h('div', { style: css.muted }, '尚未立宪法。没有宪法，交易会被拒绝。'),
        ),

        !holdingStage ? guardsBlock : null,

        onOpenPrompts
          ? h('div', {
            key: 'more',
            style: { ...css.muted, marginTop: 4, marginBottom: 8 },
          }, [
            '需要话术模板？',
            h('button', {
              type: 'button',
              style: { ...css.btnGhost, color: 'var(--dsw-alias-brand-primary)' },
              onClick: onOpenPrompts,
            }, '打开提示词'),
          ])
          : null,

        preview ? h('div', {
          key: 'preview',
          style: {
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 45%, transparent)',
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
              style: {
                flex: 1,
                width: '100%',
                border: 0,
                background: 'var(--dsw-alias-bg-base)',
              },
            }),
          ]),
        ]) : null,
      ])
    }

    function PlaybooksView({ initialStage }) {
      const [stages, setStages] = useState([])
      const [active, setActive] = useState(initialStage || 'conductor')
      const [text, setText] = useState('')
      const [mode, setMode] = useState('preview') // preview | source
      const [error, setError] = useState('')

      useEffect(() => {
        if (initialStage) setActive(initialStage)
      }, [initialStage])

      useEffect(() => {
        api('/api/playbooks')
          .then((d) => {
            setStages(d.stages || [])
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

      const modeBtn = (id, label) => h('button', {
        key: id,
        type: 'button',
        style: {
          ...css.btn,
          ...(mode === id
            ? { borderColor: 'var(--dsw-alias-border-l2)', fontWeight: 600 }
            : null),
        },
        onClick: () => setMode(id),
      }, label)

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
            padding: '10px 12px',
          },
        }, [
          h('div', { key: 'id', style: { fontSize: 13, fontWeight: 650 } },
            PLAYBOOK_LABEL[s.stage] || s.stage),
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
          }, [modeBtn('preview', '预览'), modeBtn('source', '源码')]),
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

    function JournalView({ symbolFilter, onClearFilter, onGoWorkspace }) {
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
        h('div', {
          key: 'banner',
          style: {
            ...css.card,
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
          },
        }, [
          h('div', { key: 'l', style: { fontSize: 13 } },
            symbolFilter
              ? ('正在查看 ' + symbolFilter + ' 的流水')
              : '正在查看全部流水（工作台未选中档案）'),
          h('div', { key: 'r', style: { display: 'flex', gap: 6 } }, [
            symbolFilter
              ? h('button', {
                key: 'all',
                type: 'button',
                style: css.btn,
                onClick: () => onClearFilter && onClearFilter(),
              }, '看全部')
              : h('button', {
                key: 'ws',
                type: 'button',
                style: css.btn,
                onClick: () => onGoWorkspace && onGoWorkspace(),
              }, '去工作台选档案'),
          ]),
        ]),
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
              : '追加一条流水备注（未选档案则不绑定标的）',
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
          ? h('div', { key: 'empty', style: css.empty }, '还没有流水。')
          : rows.map((r, i) => h('div', {
            key: String(r.ts) + '-' + i,
            style: { ...css.card, marginBottom: 8 },
          }, [
            h('div', {
              key: 'top',
              style: { display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
            }, [
              h('span', { key: 'a', style: { fontSize: 13, fontWeight: 650 } },
                [r.action, r.trade, r.symbol].filter(Boolean).join(' · ') || 'note'),
              h('span', { key: 't', style: css.muted },
                r.ts ? String(r.ts).replace('T', ' ').slice(0, 19) : ''),
            ]),
            h('div', { key: 'reason', style: css.bodyText },
              r.reason || r.text || JSON.stringify(r)),
          ])),
      ])
    }

    function fillPromptTemplate(text, { symbol, name, price, avgCost, qty }) {
      const namePart = name ? '（' + name + '）' : ''
      return String(text || '')
        .replace(/\{\{symbol\}\}/g, symbol || '代码')
        .replace(/\{\{namePart\}\}/g, namePart)
        .replace(/\{\{name\}\}/g, name || '')
        .replace(/\{\{price\}\}/g, price != null && price !== '' ? String(price) : '现价')
        .replace(/\{\{avgCost\}\}/g, avgCost != null ? String(avgCost) : '成本')
        .replace(/\{\{qty\}\}/g, qty != null ? String(qty) : '股数')
    }

    function LedgerPage({ ctx }) {
      const [tab, setTab] = useState('dossiers')
      const [rows, setRows] = useState([])
      const [stats, setStats] = useState({ holding: 0, byStage: {} })
      const [dir, setDir] = useState('')
      const [selected, setSelected] = useState('')
      const [filter, setFilter] = useState('')
      const [error, setError] = useState('')
      const [playbookStage, setPlaybookStage] = useState('conductor')
      const [researchOpen, setResearchOpen] = useState(false)
      const t = ctx.locale.bind(NS)
      const selectedRow = rows.find((r) => r.symbol === selected) || null

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

      function continueInChat(dossier, promptOverride) {
        const symbol = dossier && dossier.symbol
        if (!symbol) return
        const prompt = promptOverride || (
          '打开 ' + symbol + (dossier.name ? '（' + dossier.name + '）' : '')
          + '：先 stock_next，再按返回的手册与建议调用推进。'
        )
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

      function openPlaybook(stage) {
        setPlaybookStage(stage || 'conductor')
        setTab('playbooks')
      }

      return h('div', { style: css.page }, [
        h('header', { key: 'header', style: css.header }, [
          h('div', { key: 'left' }, [
            h('h1', { key: 't', style: css.title }, t('title')),
            h('p', { key: 's', style: css.sub },
              t('subtitle') + (dir ? ' · ' + dir : '')),
          ]),
          h('div', { key: 'right', style: { display: 'flex', gap: 8, alignItems: 'center' } }, [
            selected
              ? h('span', { key: 'cur', style: css.chip('neutral') }, '当前 ' + selected)
              : null,
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
                h('button', {
                  key: 'toggle',
                  type: 'button',
                  style: {
                    ...css.btnGhost,
                    width: '100%',
                    textAlign: 'left',
                    padding: '4px 0',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--dsw-alias-label-primary)',
                  },
                  onClick: () => setResearchOpen(!researchOpen),
                }, (researchOpen ? '▾ ' : '▸ ') + t('newDossier')),
                researchOpen
                  ? h(StartResearch, { key: 'form', ctx })
                  : h('div', { key: 'hint', style: { ...css.muted, marginTop: 4 } },
                    '填代码后开新对话，从五年数据开始。'),
              ]),
            ]),
            h('div', { key: 'right' }, h(DetailPanel, {
              symbol: selected,
              onContinue: continueInChat,
              onOpenPlaybook: openPlaybook,
              onOpenPrompts: () => setTab('prompts'),
            })),
          ]) : null,
          tab === 'playbooks' ? h(PlaybooksView, {
            key: 'pb-' + playbookStage,
            initialStage: playbookStage,
          }) : null,
          tab === 'prompts' ? h(PromptsView, {
            key: 'pr',
            symbol: selected,
            name: selectedRow && selectedRow.name,
            qty: selectedRow && selectedRow.qty,
            avgCost: selectedRow && selectedRow.avgCost,
            onGoWorkspace: () => setTab('dossiers'),
          }) : null,
          tab === 'journal' ? h(JournalView, {
            key: 'j',
            symbolFilter: selected || '',
            onClearFilter: () => setSelected(''),
            onGoWorkspace: () => setTab('dossiers'),
          }) : null,
          tab === 'notes' ? h(NotesView, { key: 'notes' }) : null,
        ]),
      ])
    }

    function PromptsView({ symbol, name, qty, avgCost, onGoWorkspace }) {
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

      function filled(text) {
        return fillPromptTemplate(text, { symbol, name, qty, avgCost })
      }

      function copy(id, text) {
        try {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(filled(text))
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
          h('div', {
            key: 'top',
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
          }, [
            h('div', { key: 't', style: { fontSize: 14, fontWeight: 650 } }, '每个阶段怎么往下走'),
            symbol
              ? h('span', { key: 'sym', style: css.chip('good') }, '已填入 ' + symbol)
              : h('button', {
                key: 'pick',
                type: 'button',
                style: css.btn,
                onClick: () => onGoWorkspace && onGoWorkspace(),
              }, '去工作台选档案'),
          ]),
          h('div', { key: 'd', style: { ...css.muted, lineHeight: 1.6 } },
            symbol
              ? ('复制时会自动把 {{symbol}} 换成 ' + symbol + '。')
              : ('尚未选中档案，复制仍带占位符。' + (hint ? ' ' + hint : ''))),
          h('div', { key: 'n', style: { ...css.muted, marginTop: 6 } },
            '规则：stock_data check 通过前不写 verdict；没有宪法不建仓；先 stock_next 再动手。'),
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
              h('span', { key: 'x', style: { fontSize: 13, fontWeight: 600 } }, p.title),
              h('button', {
                key: 'c',
                type: 'button',
                style: { ...css.btn, padding: '2px 9px', fontSize: 11 },
                onClick: () => copy(s.stage + i, p.text),
              }, copied === s.stage + i ? '已复制' : '复制'),
            ]),
            h('div', {
              key: 'tx',
              style: { fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap' },
            }, filled(p.text)),
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
            subtitle: '先看状态，再动手；规则写在交易之前',
            refresh: '刷新',
            tabDossiers: '工作台',
            tabPlaybooks: '手册',
            tabPrompts: '提示词',
            tabJournal: '流水',
            tabNotes: '财报笔记',
            newDossier: '开始调研',
          },
          en: {
            panel: 'Ledger',
            title: 'Investment decision ledger',
            subtitle: 'Status first; rules before trades',
            refresh: 'Refresh',
            tabDossiers: 'Workspace',
            tabPlaybooks: 'Playbooks',
            tabPrompts: 'Prompts',
            tabJournal: 'Journal',
            tabNotes: 'Fin. notes',
            newDossier: 'Start research',
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
