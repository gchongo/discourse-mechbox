# MechBox 功能接入计划表

> 原则：**一次只点亮 1 个工具** → 本地/容器验证 → rebuild → 硬刷新 → 再生产下一个。  
> 设计链（联动分析）**不接入**。  
> UI 稳定模式：`/mechbox?tool_id=` 单路由 + vanilla JS 挂载（参考螺栓页）。

## 当前进度

| 状态 | 数量 | 说明 |
|------|------|------|
| ✅ 已接入 | 24 | `gear_ratio`、`bolt_clamp_load`、`unit_converter`、`rss_calculation`、`thread`、`key`、`bolt_group`、`weld`、`spring`、`clutch`、`belt`、`chain`、`tol_convert`、`sigma_analysis`、`fit`、`distribution_chart`、`thermal_expansion`、`interference_fit`、`bearing`、`shaft`、`gear`、`fatigue`、`beam`、`sheet_metal` |
| ⏳ 首页目录 | 57 | 分析 18 + 统计 7 + 机械 32（与 MechBox 对齐；不含设计链） |
| ❌ 明确不做 | 3 | 设计项目 / 轴系设计链 / 螺栓连接设计链 |

**W1 完成** ✅：`unit_converter` · `rss_calculation`  
**产品修正**：`gdt_position` **不作为独立首页工具**。位置度属于「尺寸链编辑器 / 分析类型（GD&T）」与后续 `gdt_stack`；计算核可保留供尺寸链内复用，但不点亮、不上目录。  
**W2.1 完成** ✅：`thread` 螺纹强度（简化 / 完整 / 专业 VDI）  
**W2.2 完成** ✅：`key` 平键连接（简化 / 完整推荐键长 / 专业多键与幅值门限）  
**W2.3 完成** ✅：`bolt_group` 螺栓组（简化 / 矢量分解 / 专业抗滑与撬力）  
**W2.4 完成** ✅：`weld` 焊缝强度（角焊/对接；简化 / 三标准 / 专业合成与 HAZ）  
**W2.5 完成** ✅：`spring` 弹簧设计（简化刚度剪切 / 完整稳定性 / 专业疲劳）  
**W2.6 完成** ✅：`clutch` 离合器（简化摩擦扭矩 / 完整有效半径比压 / 专业离心热衰减）  
**W2.7 完成** ✅：`belt` 皮带传动（简化长度张力 / 完整包角带速 / 专业工况寿命）  
**W2.8 完成** ✅：`chain` 链传动（简化链长张力 / 完整链速许用 / 专业多排寿命）  
**W3.1 完成** ✅：`tol_convert` 公差转换（T↔σ；简化正态 / 完整多分布 / 专业自定义 K）  
**W3.2 完成** ✅：`sigma_analysis` 西格玛 / Cpk（简化 C·Cpk / 完整门槛 / 专业样本与长期 σ）  
**W3.3 完成** ✅：`fit` ISO 286 配合（简化间隙 / 完整品质指数 / 专业热修正）  
**W3.4 完成** ✅：`distribution_chart` 分布曲线（简化正态 PDF / 完整采样表 / 专业合格率；暂无 Plotly）  
**W4.1 完成** ✅：`thermal_expansion` 热膨胀（简化线膨胀 / 完整配合变化 / 专业 α(T)+装配/工况两段）  
**W4.2 完成** ✅：`interference_fit` 过盈配合（简化接触压 / 完整空心轴与环向门限 / 专业温差修正）  
**W4.3 完成** ✅：`bearing` 轴承寿命（简化 L10 / 完整 X·Y 查表与 a₁·aISO / 专业 a₂·极限转速）  
**W4.4 完成** ✅：`shaft` 轴强度（扭转 / 弯扭合成；简化实心 / 完整空心与转角 / 专业 Kt 峰值；疲劳未放行）  
**W4.5 完成** ✅：`gear` 齿轮强度（简化 Lewis / 完整 ISO 6336 简化 / 专业 ISO↔AGMA）  
**W4.6 完成** ✅：`fatigue` 疲劳寿命（简化 Basquin / 完整 Miner / 专业 Goodman·Se′）  
**W4.7 完成** ✅：`beam` 梁挠度（简化估算 / 完整利用率 / 专业 Kd·Kt；疲劳未放行）  
**W4.8 完成** ✅：`sheet_metal` 钣金展开（K 因子 / BD；完整法兰 / 专业回弹）  
**说明**：`structural` / `cylinder` 计算核保留但未点亮。  
**下一步**：W4.9 `o_ring`（需补 catalog id）或按表继续 `cylinder`

---

## 总览：分波次接入

| 波次 | 目标 | 工具数 | 预估节奏 | 依赖 |
|------|------|--------|----------|------|
| **W0** | 平台打磨（已基本完成） | — | — | 首页目录、calculate API、安全挂载模式 |
| **W1** | 快赢：简单服务端内置 | 3 | 1～2 天/个 | 现有 `CalculatorRegistry` 模式 |
| **W2** | 紧固 / 传动小品 | 8 | 2～3 天/个 | MechBox 公式移植 → Ruby 或 vanilla |
| **W3** | 公差基础统计 | 4 | 2～4 天/个 | 表驱动 + 图表（可后置 Plotly） |
| **W4** | 强度与材料主线 | 10 | 3～5 天/个 | 查表数据、多模式（简/全/专） |
| **W5** | 尺寸链与 GD&T 栈 | 4 | 1～2 周/个 | 编辑器 UI；可先只读计算 |
| **W6** | 高级统计 / 质量 | 5 | 1 周+/个 | Monte Carlo、回归等 |
| **W7** | 分析类型（18） | 18 | 挂靠 W5 | 实质是尺寸链预设入口，非独立引擎 |
| **W8** | 平台增强 | — | 穿插 | 记录、收藏、单位制、导出 |

---

## W1 — 快赢内置（优先）

Schema / 部分逻辑已在 `ToolCatalog::BUILTIN_TOOLS`。

| 序号 | tool_id | 名称 | 实现方式 | 难度 | 验收要点 |
|------|---------|------|----------|------|----------|
| 1.1 | `unit_converter` | 单位换算 | 服务端 builtin | ★ | mm/in、MPa/psi 互转 |
| 1.2 | `rss_calculation` | RSS 计算 | 服务端 builtin | ★ | 基础 RSS；加权可二期 |
| 1.3 | ~~`gdt_position`~~ | （已撤销独立工具） | — | — | 并入尺寸链 / GD&T 栈，不上首页 |

**每工具清单**：Registry 公式 → 通用或专用 vanilla 表单 → `ENABLED_BUILTIN` 点亮 → 中英文案 → 请求/验收测试 → rebuild。

---

## W2 — 紧固与传动（小表单）

与螺栓预紧力体验一致：左输入 / 右结果；先简化模式，完整/专业可二期。

| 序号 | tool_id | 名称 | 来源 | 难度 | 状态 |
|------|---------|------|------|------|------|
| 2.1 | `thread` | 螺纹强度 | MechBox `/thread` | ★★ | ✅ |
| 2.2 | `key` | 平键连接 | `/key` | ★★ | ✅ |
| 2.3 | `bolt_group` | 螺栓组 | `/bolt-group` | ★★☆ | ✅ |
| 2.4 | `weld` | 焊缝强度 | `/weld` | ★★ | ✅ |
| 2.5 | `spring` | 弹簧设计 | `/spring` | ★★ | ✅ |
| 2.6 | `clutch` | 离合器 | `/clutch` | ★☆ | ✅ |
| 2.7 | `belt` | 皮带传动 | `/belt` | ★★ | ✅ |
| 2.8 | `chain` | 链传动 | `/chain` | ★★ | ✅ |

建议顺序：`thread` → `key` → `bolt_group` → `weld` → 其余。

---

## W3 — 公差 / 统计基础

| 序号 | tool_id | 名称 | 难度 | 备注 |
|------|---------|------|------|------|
| 3.1 | `tol_convert` | 公差转换 T↔σ | ★★ | ✅ |
| 3.2 | `sigma_analysis` | 西格玛 / Cpk | ★★ | ✅ |
| 3.3 | `fit` | ISO 286 配合 | ★★★ | ✅ |
| 3.4 | `distribution_chart` | 分布曲线 | ★★★ | ✅ 先出数；Plotly 二期 |

`rss_calculation` 已在 W1，统计区可显示为已可用。

---

## W4 — 强度 / 材料 / 结构主线

| 序号 | tool_id | 名称 | 难度 | 备注 |
|------|---------|------|------|------|
| 4.1 | `thermal_expansion` | 热膨胀 | ★★ | ✅ |
| 4.2 | `interference_fit` | 过盈配合 | ★★★ | ✅ Lame 接触压 |
| 4.3 | `bearing` | 轴承寿命 | ★★★ | ✅ ISO 281 |
| 4.4 | `shaft` | 轴强度 | ★★★ | ✅ 扭转+弯扭；疲劳未放行 |
| 4.5 | `gear` | 齿轮强度 | ★★★★ | ✅ Lewis / ISO 6336 简化 / AGMA 对照 |
| 4.6 | `fatigue` | 疲劳寿命 | ★★★★ | ✅ Basquin + Miner + Goodman |
| 4.7 | `beam` | 梁挠度 | ★★★ | ✅ 简/全/专；疲劳未放行 |
| 4.8 | `sheet_metal` | 钣金展开 | ★★ | ✅ K 因子 / BD + 法兰 / 回弹 |
| 4.9 | `o_ring` | O 型圈 | ★★ | 需补 catalog id |
| 4.10 | `cylinder` | 液压/气缸 | ★★ | 计算核已有，未点亮 |
| 4.11 | `materials` | 材料库 | ★★ | 只读查表可先 |
| 4.12 | `material_selection` | 材料选型 | ★★★ | |
| 4.13 | `heat_treatment` | 热处理硬度 | ★★★ | |
| 4.14 | `manufacturing` | 制造工艺 | ★★ | |
| 4.15 | `structural` | 结构/流体 | ★★★ | 计算核已有，未点亮；可拆子工具 |
| 4.16 | `thread_table` | 螺纹标准表 | ★★★ | 规格库；需补 catalog |

---

## W5 — 尺寸链与 GD&T（高价值、高成本）

| 序号 | tool_id | 名称 | 难度 | 策略 |
|------|---------|------|------|------|
| 5.1 | `size_chain` | 尺寸链编辑器 | ★★★★★ | 先 RSS/极值固定链路；编辑器二期 |
| 5.2 | `gdt_stack` | GD&T 公差栈 | ★★★★ | |
| 5.3 | `batch_analysis` | 批量验证 | ★★★★ | 依赖 size_chain 数据结构 |
| 5.4 | `tolerance_allocation` | 公差分配 | ★★★★ | 遗传/Pareto 可后置 |

---

## W6 — 高级统计 / 质量

| 序号 | tool_id | 名称 | 难度 |
|------|---------|------|------|
| 6.1 | `monte_carlo` | Monte Carlo | ★★★★ |
| 6.2 | `quality` | MSA / SPC / FMEA | ★★★★★ |
| 6.3 | `analytics` | 回归 / DOE / RSM | ★★★★★ |

可考虑长期保持「即将推出」，或拆成多个子 tool_id。

---

## W7 — 分析类型（18）

不单独造引擎：在 `size_chain` 可用后，用 `type` 预设打开编辑器。

| 分组 | 工具 | 依赖 |
|------|------|------|
| 1D 线性 | 齿轮间隙、轴承配合、轴径公差、垫片厚度 | W5.1 |
| 2D 平面 | 平行度、垂直度、轮廓度、平面度、直线度 | W5.1 |
| 3D 空间 | 立体/箱体/机架装配、空间叠加 | W5.1 |
| GD&T | 位置度、同轴度、轮廓度、跳动、圆度 | W5.1 + 可选 W5.2 |

---

## W8 — 平台能力（可与工具并行）

| 项 | 说明 | 优先级 |
|----|------|--------|
| 计算记录 | DB 已有迁移；`records` API | 中 |
| 收藏工具 | favorites | 低 |
| 用户单位制 | preferences 已有字段 | 中 |
| 公式模板 | template CRUD | 低 |
| 导出 PDF/图 | 后置 | 低 |

---

## 推荐近 6 周排期（可执行）

| 周 | 交付 |
|----|------|
| 第 1 周 | `unit_converter` + `rss_calculation` |
| 第 2 周 | `thread` + `key` |
| 第 3 周 | `bolt_group` + `thermal_expansion` |
| 第 4 周 | `fit`（ISO 286）或 `bearing`（二选一深挖） |
| 第 5 周 | `tol_convert` + `sigma_analysis` |
| 第 6 周 | `shaft` 或启动 `size_chain` MVP（无图形编辑器） |

之后按 W4 → W5 → W6 循环；每个工具仍遵守「单工具启用」。

---

## 单工具接入检查清单（复制用）

- [ ] MechBox 源：公式 / 输入输出 / 帮助文案对齐
- [ ] `ToolCatalog` 登记（builtin 或 client）
- [ ] 计算实现（Ruby registry **或** vanilla 客户端）
- [ ] vanilla 工具页挂载（避免 Ember `{{on}}` / 子路由）
- [ ] `ENABLED_*_TOOL_IDS` 点亮
- [ ] `home` 图标与中英文案
- [ ] RSpec / QUnit（至少 happy path）
- [ ] Docker rebuild + 硬刷新生产验收

---

## 不做 / 延后

| 项 | 原因 |
|----|------|
| 设计链三工具 | 产品已确认取消首页展示；强依赖 projects |
| 一次合入多工具 | 易致生产 502，违反 boot 纪律 |
| 过早上完整 Ember 表单 | 历史崩溃；坚持 vanilla 挂载 |
