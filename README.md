# dsh-stock-os · 投资决策账本

给 DeepSeek Harness（DSH）用的一个插件：**把买卖规则写在交易之前，把每一个动作记成一条流水。**

它不预测涨跌，也不替你下单。它解决的是另一件事——大多数人亏钱不是因为没有观点，而是因为观点随时改：买的时候没有规则，跌的时候临时找理由，赚的时候忘了当初为什么买。这个插件把决策过程变成可以回溯的账本，让"当时怎么想的"有据可查。

---

## 一、它装进来什么

| 能力 | 作用 |
| --- | --- |
| `stock_status` | **导航（只读）**：阶段、就绪度、硬拦；不传代码则列全部档案摘要 |
| `stock_next` | **导航（只读）**：唯一主路径——该读哪本手册、建议调用序列、`chatPrompt`（面板与 Agent 共用） |
| `stock_os` | 读写一只股票的档案：初始化、写结论、立宪法、定回撤预案、记交易、风控告警、追加流水、列档案、删档案、出报告 |
| `stock_playbook` | 按阶段取出手册：`conductor` / `research` / `plan` / `entry` / `add` / `hold` / `reduce` / `exit` / `review` |
| `stock_data` | 近五年财报数据集：`set` 写入、`check` 看还缺什么（会告诉你每个科目去报表哪一行拿）、`get` 取回 |
| `stock_notes` | 8 章 132 节财报笔记当检索器：`search` 定位到具体节号与原句、`toc` 看目录、`emit` 生成带调研水印的 HTML |
| `stock_charts` | 用数据集直接出图表概览 HTML：收入/利润/现金流/应收/存货/杠杆/ROE/PE/PB/股东回报/季度，只画有数据的图 |
| `stock_report` | 把调研结论做成结论报告 HTML：报告头 / 结论带 / 五维打分 / 12 项排雷检查 / 图表 / 证据链 / 下一步。缺数据的项写"无法判断"，不猜 |
| 侧栏「投资账本」 | **工作台**（下一步英雄区 + 就绪度）与资料页（手册 / 提示词 / 流水 / 笔记）；与 Agent 共用 guidance |

涉及个股时先 `stock_status` / `stock_next`，再按返回的 `suggestedCalls` 执行写操作。

调研有先后顺序，而且是硬性的：

```
stock_next ──▶ stock_data（近五年，check 通过）──▶ stock_notes（找依据）──▶ stock_charts（出图，可选）
        ──▶ stock_os verdict ──▶ stock_report（结论报告）
```

没有通过检查的数据集，`verdict` 会被拒绝写入；确实拿不到数据时，唯一允许的结论是 `na`，并要写清缺什么、去哪拿。没有 `verdict`，`stock_report` 也不会出报告。

阶段是一条状态机，不是任务清单：

```
idea ──▶ research ──▶ plan ──▶ open ──▶ hold ──▶ closed
          ▲              │        │        │
          └──────────────┘        └────────┘（可退回研究，也可直接清仓）
```

`plan` 可以退回 `research`（研究完发现不够格）；`open`/`hold` 可以直接 `closed`（触红线就走）。交易只有四种：`open` / `add` / `reduce` / `close`。

---

## 二、安装

### 方式 A：从 GitHub 装（推荐给其他人用）

在 DSH 的插件市场里选"从 GitHub 安装"，填：

```
github:Flyingxin/dsh-stock-os
```

或者让 DSH 里的 agent 直接装（把仓库地址原样给它）：

```
用 plugin_manager 安装 github:Flyingxin/dsh-stock-os
```

安装完成后，在插件列表里确认 `dsh-stock-os` 处于启用状态。

### 方式 B：本地目录装（自己改代码时用）

```powershell
git clone https://github.com/Flyingxin/dsh-stock-os.git
```

然后把**克隆下来的目录**作为安装目标装进 profile。装好后改代码不会自动生效，需要在插件列表里关一次再开一次，让 DSH 重新加载。

### 装完检查

- 工具列表里出现 `stock_status`、`stock_next`、`stock_os`、`stock_playbook`、`stock_data`、`stock_notes`、`stock_charts`、`stock_report`；
- 插件详情页能显示标题与图标（来自 `locale/` 与 `icon.svg`）；
- 第一次调用 `stock_status`（不传 symbol）或 `stock_os` 加 `action: "list"`，返回"还没有档案"，并告诉你数据目录在哪里。

---

## 三、数据放在哪

默认 `~/.stock-os`：

```
~/.stock-os/
  600519.SH.json        一只股票一份档案（结论、宪法、预案、持仓、来源会话）
  journal.jsonl         只追加的流水，一行一个动作
  data/600519.SH.json   近五年财报数据集（stock_data 写入）
  reports/              生成的图表概览与结论报告 HTML
  _deleted/             被删档案的归档（文件名带时间戳）
```

`journal.jsonl` 是**只追加**的：写错了不删，追加一条 `correction`。删除档案也只是把它移到 `_deleted/`，流水一行不动。这是刻意的——账本的价值在于留痕，不在好看。

想把数据放到别处，**不要改仓库里的 `cordis.patch.yml`**，改你自己的 profile 补丁层：

```yaml
- id: stock-os
  name: dsh-stock-os
  config:
    dataDir: 'D:\my-data\stock-os'
```

---

## 四、一次完整的使用

```
帮我看看 600519.SH 现在能不能买
```

第一步不是画图，也不是下结论，而是**问导航**：

```
stock_next symbol=600519.SH
```

（没有档案时先 `stock_os init`，或让 agent 从 `stock_status` 列表现状。）`stock_next` 会给出当前阶段、就绪度缺口，以及建议调用序列。典型调研路径仍是**把近五年财报数据摊开**：

```
stock_data action=set symbol=600519.SH dataset={ years:[...], series:{ revenue:[...], netProfit:[...], opCash:[...], ... } }
stock_data action=check symbol=600519.SH
```

`check` 会逐项告诉你缺什么、去报表哪一行拿。数据完整之后，agent 会按 `research` 手册做九项核查（行业、生意、护城河、财务底稿、估值、内部人……），中途用 `stock_notes` 检索依据、用 `stock_charts` 出图，最后把结论写成 `verdict`：`pass` / `watch` / `fail` / `suspect` / `na`。只有 `pass` 和 `watch` 才允许往下走。

调研收尾时用 `stock_report` 出一份报告，把结论、12 项排雷检查、证据出处放在一页里：

```
stock_report action=emit symbol=600519.SH
```

接着立宪法（`plan` 阶段），至少写清：单只上限、分几批、首笔比例、止损线、止盈线、回撤预案、复盘周期。没有宪法，交易工具会直接拒绝执行——**这是设计，不是故障**。

再往后：记首笔、记加仓、跑风控、减仓、清仓、复盘。每一步都可以只做一半就停，档案会记住停在哪；不确定时再调一次 `stock_next`。

### 面板怎么用

- **工作台**：左侧列表可搜、可删（悬停后点删，再点确认）；右侧顶部是「下一步」英雄区（与 `stock_next` 同源）、「就绪度」五格，以及「按此继续对话」（塞入同一条 `chatPrompt`）。
- **开始调研**：展开列表底表单 → 填代码 → 新对话附调研提示词；档案由 agent 在调研阶段 `stock_os init` 创建。
- **提示词 / 流水 / 手册**：带当前选中档案上下文（提示词自动替换 `{{symbol}}`；流水默认按标的过滤）。
- 离线提示词见 `docs/PROMPTS.md`。

---

## 五、边界（读一下，能省掉很多误会）

- **不下单。** 插件不接券商，只记账和拦截。买卖还是要你自己点。
- **不推荐。** 手册里给的是检查项与判定口径，不是"该买什么"。
- **不是投资建议。** 结论是给你自己复核用的，出了错算你的。
- **拦截是硬拦。** 超仓位、亏损加仓、无预案交易，都会被拒绝；确实要破例，得写明 `overrideReason`，并且会被记进流水。
- **报告不补数据。** 12 项检查里没有数据集支持的（利息收入、商誉、非经常性损益、关联方、客户集中度、审计意见）就写"无法判断"，不用行业均值或上年外推。

---

## 六、目录

```
index.js            Host：工具 + /stock-os API（零第三方依赖）
client.js           Client：侧栏入口与主区页面（工作台）
lib/api.js          面板数据面（含 /api/status、/api/next、/api/data、/api/report…）
lib/guidance.js     Agent 与面板共用的阶段路由（status / next）
lib/dataset.js      近五年数据集的存储与完整性检查（verdict 的准入门槛）
lib/notes.js        132 节笔记的解析、检索、带水印导出
lib/charts.js       数据集 → 图表概览 HTML（ECharts，缺数据不画）
lib/report.js       结论报告 HTML：12 项排雷检查、五维打分、证据链
lib/prompts.js      八个阶段的提示词（面板与 docs/PROMPTS.md 同源）
lab/fin-notes.html  交互式笔记（侧栏里直接打开）
cordis.patch.yml    插件入口声明
playbooks/          九本阶段手册（按需读取，不常驻上下文）
locale/             zh / en 展示文本
icon.svg            插件图标
docs/DETAIL.md      设计说明：状态机、数据契约、为什么这么拆
docs/PROMPTS.md     每个阶段的提示词（可直接复制）
```

---

## License

MIT © Flyingxin
