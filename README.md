# dsh-stock-os · 投资决策账本

给 DeepSeek Harness（DSH）用的一个插件：**把买卖规则写在交易之前，把每一个动作记成一条流水。**

它不预测涨跌，也不替你下单。它解决的是另一件事——大多数人亏钱不是因为没有观点，而是因为观点随时改：买的时候没有规则，跌的时候临时找理由，赚的时候忘了当初为什么买。这个插件把决策过程变成可以回溯的账本，让"当时怎么想的"有据可查。

---

## 一、它装进来什么

| 能力 | 作用 |
| --- | --- |
| `stock_os` | 读写一只股票的档案：初始化、写结论、立宪法、定回撤预案、记交易、风控告警、追加流水、列档案 |
| `stock_playbook` | 按阶段取出手册：`conductor` / `research` / `plan` / `entry` / `add` / `hold` / `reduce` / `exit` / `review` |
| 侧栏「投资账本」 | 网页工作台：档案列表/详情、手册、流水；交易写入仍建议在对话里按手册完成 |

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

- 工具列表里出现 `stock_os` 与 `stock_playbook`；
- 插件详情页能显示标题与图标（来自 `locale/` 与 `icon.svg`）；
- 第一次调用 `stock_os` 加 `action: "list"`，返回"还没有档案"，并告诉你数据目录在哪里。

---

## 三、数据放在哪

默认 `~/.stock-os`：

```
~/.stock-os/
  600519.SH.json    一只股票一份档案（结论、宪法、预案、持仓、流水摘要）
  journal.jsonl     只追加的流水，一行一个动作
```

`journal.jsonl` 是**只追加**的：写错了不删，追加一条 `correction`。这是刻意的——账本的价值在于留痕，不在好看。

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

agent 会按 `research` 手册做九项核查（行业、生意、护城河、财务底稿、估值、内部人……），把结论写成 `verdict`：`pass` / `watch` / `fail` / `na`。只有 `pass` 和 `watch` 才允许往下走。

接着立宪法（`plan` 阶段），至少写清：单只上限、分几批、首笔比例、止损线、止盈线、回撤预案、复盘周期。没有宪法，交易工具会直接拒绝执行——**这是设计，不是故障**。

再往后：记首笔、记加仓、跑风控、减仓、清仓、复盘。每一步都可以只做一半就停，档案会记住停在哪。

---

## 五、边界（读一下，能省掉很多误会）

- **不下单。** 插件不接券商，只记账和拦截。买卖还是要你自己点。
- **不推荐。** 手册里给的是检查项与判定口径，不是"该买什么"。
- **不是投资建议。** 结论是给你自己复核用的，出了错算你的。
- **拦截是硬拦。** 超仓位、亏损加仓、无预案交易，都会被拒绝；确实要破例，得写明 `overrideReason`，并且会被记进流水。

---

## 六、目录

```
index.js            Host：工具 + /stock-os API（零第三方依赖）
client.js           Client：侧栏入口与主区页面
lib/api.js          面板数据面
cordis.patch.yml    插件入口声明
playbooks/          九本阶段手册（按需读取，不常驻上下文）
locale/             zh / en 展示文本
icon.svg            插件图标
docs/DETAIL.md      设计说明：状态机、数据契约、为什么这么拆
```

---

## License

MIT © Flyingxin
