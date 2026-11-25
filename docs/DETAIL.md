# 投资决策账本

把"靠感觉买卖"换成"有规则、有记录、可复盘"。插件不预测涨跌，也不下单；它只保证三件事：**动手前规则已经写好、每个动作留一条记录、规则不能被事后悄悄改掉。**

## 编排入口 + 六个执行工具 + 一个侧栏页

| 能力 | 作用 |
|---|---|
| `stock_status` | **导航（只读）**：看阶段、就绪度（数据/结论/宪法/回撤/复盘）、硬拦。不传代码则列全部档案摘要 |
| `stock_next` | **导航（只读）**：给定代码，返回唯一主路径——手册、`suggestedCalls`、面板可塞进对话的 `chatPrompt` |
| `stock_playbook` | 读某一阶段的操作手册：`conductor`（总纲）、`research`（买前调研）、`plan`（策略宪法）、`entry`（建仓）、`add`（加仓）、`hold`（持有）、`reduce`（减仓）、`exit`（清仓）、`review`（复盘） |
| `stock_os` | 读写股票档案与流水：`init / get / list / verdict / constitution / plan / stage / trade / journal / guards / delete / report` |
| `stock_data` | 近五年财报数据集：`set` / `check` / `get`。`verdict` 的前置门槛，检查项会指到报表具体行 |
| `stock_notes` | 132 节财报笔记：`search`（节号+原句）/ `toc` / `emit`（带调研水印的单文件 HTML） |
| `stock_charts` | 数据集 → 图表概览 HTML（ECharts），只画有数据的图，缺字段自动省略 |
| `stock_report` | 调研结论 → 结论报告 HTML：报告头 / 结论带 / 五维打分 / 12 项排雷检查 / 图表 / 证据链 / 下一步。缺数据的检查项写“无法判断”，不猜 |
| 侧栏「投资账本」 | **工作台**（档案+下一步英雄区）+ 资料（手册 / 提示词 / 流水 / 财报笔记）。Agent 与面板共用同一套 guidance 路由 |

**编排与执行分离**：`stock_status` / `stock_next` 只回答「现在在哪、下一步干什么」；写操作仍走原工具。买卖写入（`trade` / `constitution` / `verdict` 等）仍建议在对话里完成——页面负责看清状态与跑 `guards`，不替代手册流程。

## 典型用法

```
stock_os action=init symbol=600519.SH name=贵州茅台 capital=200000
stock_next symbol=600519.SH          # 看主路径与建议调用
stock_playbook stage=research        # 按返回的 playbook 读手册
stock_data action=set / check …
stock_os action=verdict …
stock_next symbol=600519.SH          # 再问一次：该立宪法了吗？
stock_os action=constitution / plan / stage …
stock_os action=guards symbol=600519.SH price=1520
stock_os action=trade …
```

第一次打开某只票，也可以只说「打开 600519」，agent 应先 `stock_status` 或 `stock_next`。

## 硬规则（写死在工具里）

- 没有策略宪法 → 拒绝建仓记录。
- 结论不是 `pass` / `watch` → 拒绝建仓。
- 没有回撤预案 → 不能进入 `plan`。
- 亏损价加仓 → 默认拦截，必须带 `force` 与 `overrideReason`，并原样写进流水。
- 超出仓位上限 / 单笔上限 → 拒绝。
- `stage` 只能沿状态机走（`idea → research → plan → open → hold → closed`）。
- 近五年数据集没通过 `check` → `verdict` 拒绝写入（唯一例外是 `na`：数据确实拿不到时，允许写下"无法判断"）。

## 数据位置

默认 `~/.stock-os/`：

- `SYMBOL.json`：每只股票的档案（结论、宪法、仓位、回撤预案）
- `journal.jsonl`：只追加的流水，一行一个 JSON
- `data/SYMBOL.json`：近五年财报数据集（`stock_data` 写入）
- `reports/`：生成的图表概览与结论报告 HTML
- `_deleted/`：被删档案的归档（文件名带时间戳）

都是纯文本，可以直接读、diff、备份。改 `config.dataDir` 可换目录。

## 每个阶段用什么提示词

面板「提示词」标签页按阶段列出了可以直接复制的话术（选中档案时自动替换 `{{symbol}}`），离线版见 `docs/PROMPTS.md`（与 `lib/prompts.js` 同源）。工作台「按此继续对话」使用与 `stock_next` 同一条 `chatPrompt`。

## 边界

- 不连接券商，不自动下单，不给"今天买什么"的建议。
- 不包含行情与财报数据源：调研数据由会话内的检索、上传的报表与已有笔记提供。
- 定时任务只做提醒与检查（见 `hold` 手册），不会替你交易。
