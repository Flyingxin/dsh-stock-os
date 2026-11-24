# 投资决策账本

把"靠感觉买卖"换成"有规则、有记录、可复盘"。插件不预测涨跌，也不下单；它只保证三件事：**动手前规则已经写好、每个动作留一条记录、规则不能被事后悄悄改掉。**

## 两个工具 + 一个侧栏页

| 能力 | 作用 |
|---|---|
| `stock_playbook` | 读某一阶段的操作手册：`conductor`（总纲）、`research`（买前调研）、`plan`（策略宪法）、`entry`（建仓）、`add`（加仓）、`hold`（持有）、`reduce`（减仓）、`exit`（清仓）、`review`（复盘） |
| `stock_os` | 读写信贷档案与流水：`init / get / list / verdict / constitution / plan / stage / trade / journal / guards` |
| 侧栏「投资账本」 | Client 半边页面：档案列表/详情、手册浏览、流水；数据走 Host 的 `/stock-os/api/*` |

买卖写入（`trade` / `constitution` / `verdict` 等）仍建议在对话里完成——页面负责看清状态与跑 `guards`，不替代手册流程。

## 典型用法

```
stock_os action=init symbol=600519.SH name=贵州茅台 capital=200000
stock_playbook stage=research        # 按手册做调研
stock_os action=verdict symbol=600519.SH status=watch summary="..."
stock_os action=constitution symbol=600519.SH constitution={...}
stock_os action=plan symbol=600519.SH drawdownPlan="跌破 18.4 先减半..."
stock_os action=stage symbol=600519.SH to=plan
stock_os action=guards symbol=600519.SH price=1520   # 动作前让规则先说话
stock_os action=trade symbol=600519.SH trade=open qty=100 price=1500 reason="..."
```

## 硬规则（写死在工具里）

- 没有策略宪法 → 拒绝建仓记录。
- 结论不是 `pass` / `watch` → 拒绝建仓。
- 没有回撤预案 → 不能进入 `plan`。
- 亏损价加仓 → 默认拦截，必须带 `force` 与 `overrideReason`，并原样写进流水。
- 超出仓位上限 / 单笔上限 → 拒绝。
- `stage` 只能沿状态机走（`idea → research → plan → open → hold → closed`）。

## 数据位置

默认 `~/.stock-os/`：

- `SYMBOL.json`：每只股票的档案（结论、宪法、仓位、回撤预案）
- `journal.jsonl`：只追加的流水，一行一个 JSON

都是纯文本，可以直接读、diff、备份。改 `config.dataDir` 可换目录。

## 边界

- 不连接券商，不自动下单，不给"今天买什么"的建议。
- 不包含行情与财报数据源：调研数据由会话内的检索、上传的报表与已有笔记提供。
- 定时任务只做提醒与检查（见 `hold` 手册），不会替你交易。
