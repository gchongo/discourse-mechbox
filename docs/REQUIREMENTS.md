# discourse-mechbox 需求规格说明书

**版本**：V0.2  
**更新日期**：2026-07-10  
**插件版本**：0.1（骨架阶段）  
**关联项目**：[MechBox](../../../MechBox/)（独立 Vue 应用，功能更完整）

---

## 目录

1. [项目概述](#1-项目概述)
2. [目标与范围](#2-目标与范围)
3. [用户与场景](#3-用户与场景)
4. [与独立 MechBox 的关系](#4-与独立-mechbox-的关系)
5. [功能需求](#5-功能需求)
6. [API 规格](#6-api-规格)
7. [数据模型](#7-数据模型)
8. [权限与安全](#8-权限与安全)
9. [站点设置](#9-站点设置)
10. [内置计算器](#10-内置计算器)
11. [前端集成方案](#11-前端集成方案)
12. [非功能需求](#12-非功能需求)
13. [实现状态](#13-实现状态)
14. [版本路线图](#14-版本路线图)
15. [验收标准](#15-验收标准)
16. [附录](#16-附录)

---

## 1. 项目概述

### 1.1 项目名称

| 项目 | 说明 |
|------|------|
| **插件名** | discourse-mechbox |
| **产品名** | MechBox（机械工具箱） |
| **类型** | Discourse 官方插件（Ruby Engine + Ember/GJS 前端） |
| **定位** | 在 Discourse 社区内提供机械工程计算能力：内置工具、企业自定义公式、计算记录与收藏 |

### 1.2 背景

独立项目 **MechBox**（`MechBox/`）已是功能丰富的 Vue 3 工程计算平台（尺寸链、公差统计、螺栓/轴承/传动等 40+ 工具），数据主要存于浏览器 localStorage。

**discourse-mechbox** 的目标是将 MechBox 的核心能力**嵌入 Discourse 生态**：

- 复用 Discourse 用户体系与权限组，无需单独注册登录
- 计算记录、收藏、企业公式模板持久化到 PostgreSQL
- 与论坛话题、知识库形成闭环（分享计算、讨论结果）

### 1.3 核心价值

| 痛点 | 插件方案 |
|------|----------|
| 独立站点与论坛账号割裂 | 统一 Discourse 登录与权限 |
| 计算历史仅存本地，换设备丢失 | 服务端保存计算记录（可配置上限） |
| 企业标准公式难以下发 | 管理员维护公式模板，按用户组可见 |
| 机械计算与社区讨论分离 | 同一站点内计算 + 发帖讨论 |

### 1.4 免责声明

所有计算结果基于简化工程模型，仅供学习、估算与辅助分析，**不能替代**完整标准复核或正式设计签核。涉及安全关键结构时，须由持证工程师按企业规范确认。UI 与导出报告须包含该声明。

---

## 2. 目标与范围

### 2.1 V0.1 目标（MVP，可启用）

使插件在 Discourse 中**可加载、可访问、可完成一次完整计算闭环**：

1. 后台可开启插件并配置权限组
2. 登录用户可访问 MechBox 入口页
3. 可调用内置计算器并得到结果
4. 可保存/查看/删除自己的计算记录（受站点设置约束）
5. 可收藏/取消收藏工具
6. 模板管理员可 CRUD 企业公式模板
7. 具备基础 RSpec 请求测试与必要国际化（至少 `en` + `zh_CN`）

### 2.2 V0.2 目标（体验增强）

1. 工具目录与独立 MechBox 对齐（分批迁移前端计算页或 iframe 嵌入）
2. 计算记录支持标题、搜索、分页
3. 话题联动：从计算结果一键生成草稿话题（可选）
4. 管理端模板版本历史查看

### 2.3 V1.0 目标（生产可用）

1. 覆盖独立 MechBox 主要工程工具（前端计算 + 可选服务端校验）
2. 复杂工具（尺寸链、Monte Carlo）完整集成
3. PDF/Excel 导出（复用 MechBox 导出逻辑或 Discourse 侧实现）
4. 性能与安全审计通过

### 2.4 明确不在范围内（Out of Scope）

| 项 | 说明 |
|----|------|
| 替代独立 MechBox 全部 73 项原始需求 | 插件分阶段交付，见路线图 |
| 独立用户注册/密码体系 | 完全依赖 Discourse |
| 移动端原生 App | 仅 Web（Discourse 响应式） |
| 实时协同编辑 | 不在 MVP |
| 将 MechBox 全部计算逻辑重写为 Ruby | 简单工具服务端算；复杂工具保留前端 JS |

---

## 3. 用户与场景

### 3.1 角色

| 角色 | 说明 | 典型权限 |
|------|------|----------|
| **访客** | 未登录 | 不可使用 MechBox |
| **普通成员** | 论坛登录用户 | `mechbox_allowed_groups` 内可使用计算、记录、收藏 |
| **模板管理员** | 质量/工艺负责人 | 可创建/编辑/停用企业公式模板 |
| **站点管理员** | Discourse Admin | 全部权限 + 站点设置 |

### 3.2 用户故事

| ID | 作为… | 我想要… | 以便… |
|----|--------|---------|--------|
| US-01 | 机械设计师 | 在论坛内打开齿轮比计算器并输入参数 | 快速得到转速比结果 |
| US-02 | 设计师 | 保存本次计算到历史 | 日后查阅或写入设计说明 |
| US-03 | 设计师 | 收藏常用工具 | 从首页快速进入 |
| US-04 | 质量工程师 | 使用企业配置的 RSS 模板计算 | 符合公司内部公式规范 |
| US-05 | 模板管理员 | 发布新公式模板并限制可见组 | 仅研发组可见敏感参数 |
| US-06 | 管理员 | 关闭插件或限制用户组 | 控制功能曝光范围 |
| US-07 | 成员 | 删除自己的历史记录 | 清理隐私数据 |

---

## 4. 与独立 MechBox 的关系

```
┌─────────────────────────────────────────────────────────────┐
│                    Discourse 站点                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  discourse-mechbox 插件                               │    │
│  │  • Ember/GJS UI（/mechbox）                           │    │
│  │  • REST API（/mechbox/api/*）                         │    │
│  │  • Ruby：内置计算 + 公式求值 + 持久化                  │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │ 可选：复用 JS 计算模块               │
└─────────────────────────┼───────────────────────────────────┘
                          ▼
              ┌───────────────────────┐
              │  MechBox/（独立 Vue）   │
              │  • 完整 UI 与计算引擎   │
              │  • localStorage 为主    │
              │  • 可 build 嵌入插件    │
              └───────────────────────┘
```

### 4.1 复用策略

| 层级 | 策略 |
|------|------|
| **用户与权限** | 仅用 Discourse，废弃 MechBox 独立 auth 服务 |
| **简单计算** | Ruby `CalculatorRegistry`（已实现 5 个内置工具） |
| **自定义公式** | Ruby `FormulaEvaluator`（安全表达式求值） |
| **复杂计算**（尺寸链、Monte Carlo 等） | 优先移植 `MechBox/src/utils/*.js` 到插件 assets，或 Phase 2 iframe 嵌入 |
| **UI 组件** | 按 Discourse 规范用 GJS/FormKit 重写，不直接搬 Vue 组件 |
| **文案与案例** | 可参考 `MechBox/src/i18n`、`constants` |

### 4.2 参考文档

- 独立产品完整功能清单：`MechBox/mechbox-project-requirements.md`
- 独立产品 README：`MechBox/README.md`

---

## 5. 功能需求

### 5.1 模块总览

| 模块 | 优先级 | V0.1 | 说明 |
|------|--------|------|------|
| M1 站点开关与导航 | P0 | ✅ 待实现 | 顶栏/侧边入口，`mechbox_enabled` |
| M2 工具元数据 | P0 | ✅ 待实现 | 内置工具列表、分类、输入输出 schema |
| M3 计算执行 | P0 | 部分 | 内置工具 + 模板公式 |
| M4 计算记录 | P0 | 部分 | 模型已有，API/前端待实现 |
| M5 收藏 | P0 | 部分 | 模型已有，API/前端待实现 |
| M6 公式模板 | P0 | 部分 | 模型 + 版本表已有，API/前端待实现 |
| M7 管理界面 | P1 | 待实现 | 模板管理、站点设置说明 |
| M8 扩展工具目录 | P1 | 待实现 | 对接 MechBox 工具集 |
| M9 话题联动 | P2 | 待实现 | 结果分享为话题草稿 |
| M10 导出 | P2 | 待实现 | PDF/Excel/复制 |

### 5.2 M1 — 导航与入口

| ID | 需求 | 验收标准 |
|----|------|----------|
| M1-01 | `mechbox_enabled=false` 时插件不注册路由、不显示入口 | 访客与管理员均不可访问 `/mechbox` |
| M1-02 | 启用后，授权用户在主导航显示「MechBox」入口（图标：calculator） | 无权限用户不显示 |
| M1-03 | 路由前缀 `/mechbox`，子路由由 Ember Router 管理 | 刷新页面不 404 |
| M1-04 | 移动端布局可用（复用 `mobile/mechbox.scss`） | 核心操作可完成 |

### 5.3 M2 — 工具元数据

| ID | 需求 | 验收标准 |
|----|------|----------|
| M2-01 | `GET /mechbox/api/metadata` 返回内置工具定义 | 含 `tool_id`、名称、分类、输入字段 schema、输出字段 schema |
| M2-02 | 返回当前用户可见的活跃公式模板摘要 | 不含无权限模板 |
| M2-03 | 返回站点级默认单位制（metric/imperial） | 与 `mechbox_default_unit_system` 一致 |
| M2-04 | 返回用户收藏 `tool_id` 列表 | 已登录用户 |

**内置工具元数据示例（逻辑结构）**：

```json
{
  "builtin_tools": [
    {
      "tool_id": "gear_ratio",
      "name": "Gear ratio",
      "category": "transmission",
      "inputs": [
        { "key": "driver_teeth", "type": "number", "required": true },
        { "key": "driven_teeth", "type": "number", "required": true },
        { "key": "input_speed_rpm", "type": "number", "required": true }
      ],
      "outputs": [
        { "key": "ratio", "type": "number" },
        { "key": "output_speed_rpm", "type": "number" }
      ]
    }
  ]
}
```

### 5.4 M3 — 计算执行

| ID | 需求 | 验收标准 |
|----|------|----------|
| M3-01 | `POST /mechbox/api/calculate` 执行内置工具计算 | 返回 `outputs` JSON |
| M3-02 | 请求可指定 `formula_template_id`，使用模板公式计算 | 权限校验 `can_use_mechbox_template?` |
| M3-03 | 输入校验失败返回 422 + 可读错误信息 | 使用 `mechbox.errors.*` 文案 |
| M3-04 | 未授权返回 403 | Guardian 检查 |
| M3-05 | 计算成功后，若 `mechbox_save_calculation_records=true`，可选自动落库 | 请求体 `save_record: true` |
| M3-06 | 落库时尊重 `mechbox_max_records_per_user` 上限 | 超限返回 422 |

**请求体示例**：

```json
{
  "tool_id": "bolt_clamp_load",
  "inputs": {
    "torque_nm": 50,
    "nut_factor": 0.2,
    "nominal_diameter_mm": 12
  },
  "unit_system": "metric",
  "formula_template_id": null,
  "save_record": true,
  "title": "M12 bolt preload estimate"
}
```

**响应体示例**：

```json
{
  "tool_id": "bolt_clamp_load",
  "template_id": null,
  "outputs": {
    "preload_n": 20833.333333333332,
    "preload_kn": 20.833333333333332
  },
  "record_id": 42
}
```

### 5.5 M4 — 计算记录

| ID | 需求 | 验收标准 |
|----|------|----------|
| M4-01 | `GET /mechbox/api/records` 分页列出当前用户记录 | 默认按 `created_at` 降序 |
| M4-02 | `GET /mechbox/api/records/:id` 查看单条 | 仅本人或 admin |
| M4-03 | `DELETE /mechbox/api/records/:id` 删除 | 返回 204 |
| M4-04 | 记录含 `tool_id`、`inputs`、`outputs`、`unit_system`、`title`、可选 `formula_template_id` | 与模型一致 |
| M4-05 | V0.2：支持按 `tool_id`、标题关键词筛选 | 查询参数 |

### 5.6 M5 — 收藏

| ID | 需求 | 验收标准 |
|----|------|----------|
| M5-01 | `GET /mechbox/api/favorites` 返回收藏列表 | Serializer 输出 |
| M5-02 | `POST /mechbox/api/favorites` body: `{ "tool_id": "..." }` | 幂等：重复收藏不报错 |
| M5-03 | `DELETE /mechbox/api/favorites/:tool_id` | 返回 204 |
| M5-04 | `tool_id` 可为内置或模板关联工具 | 校验 tool 存在或模板可见 |

### 5.7 M6 — 公式模板

| ID | 需求 | 验收标准 |
|----|------|----------|
| M6-01 | `GET /mechbox/api/templates` 列出可见模板 | 成员只见授权组模板 |
| M6-02 | `POST /mechbox/api/templates` 创建模板 | 仅 `can_manage_mechbox_templates?` |
| M6-03 | `PUT /mechbox/api/templates/:id` 更新 | 写入 `template_versions` 快照 |
| M6-04 | `DELETE /mechbox/api/templates/:id` 软删除或 `active: false` | 停用后不可用于计算 |
| M6-05 | 模板 `formula` 结构：`{ "outputs": { "result": "a + b * 2" } }` | `FormulaEvaluator` 可求值 |
| M6-06 | 支持 `visible_group_ids` 控制可见范围 | 空数组表示全部授权用户可见 |
| M6-07 | 每次变更记录 `change_note`（可选） | `template_versions` 表 |

### 5.8 M7 — 前端页面（Discourse）

| ID | 页面 | 功能 |
|----|------|------|
| M7-01 | `/mechbox` 首页 | 收藏、最近记录、工具分类网格 |
| M7-02 | `/mechbox/tools/:tool_id` | 单工具计算表单 + 结果展示 |
| M7-03 | `/mechbox/records` | 历史记录列表 |
| M7-04 | `/mechbox/records/:id` | 记录详情 |
| M7-05 | `/mechbox/templates` | 模板列表（管理员可编辑） |
| M7-06 | `/mechbox/templates/new`、`/edit/:id` | FormKit 表单 |

---

## 6. API 规格

**Base URL**：`/mechbox/api`  
**认证**：Discourse session cookie（`ApplicationController` 标准 `ensure_logged_in`）  
**CSRF**：POST/PUT/DELETE 需 `X-CSRF-Token`

| 方法 | 路径 | 控制器动作 | 权限 |
|------|------|------------|------|
| GET | `/metadata` | `metadata#show` | `can_use_mechbox?` |
| POST | `/calculate` | `calculations#create` | `can_use_mechbox?` |
| GET | `/records` | `records#index` | `can_use_mechbox?` |
| GET | `/records/:id` | `records#show` | 本人记录 |
| DELETE | `/records/:id` | `records#destroy` | 本人或 admin |
| GET | `/favorites` | `favorites#index` | `can_use_mechbox?` |
| POST | `/favorites` | `favorites#create` | `can_use_mechbox?` |
| DELETE | `/favorites/:tool_id` | `favorites#destroy` | `can_use_mechbox?` |
| GET | `/templates` | `templates#index` | `can_use_mechbox?` |
| POST | `/templates` | `templates#create` | `can_manage_mechbox_templates?` |
| PUT | `/templates/:id` | `templates#update` | `can_manage_mechbox_templates?` |
| DELETE | `/templates/:id` | `templates#destroy` | `can_manage_mechbox_templates?` |

### 6.1 错误响应约定

| HTTP | 场景 |
|------|------|
| 403 | 无 MechBox 权限、无模板权限 |
| 404 | 记录/模板不存在或不可见 |
| 422 | 校验失败、计算错误、记录数超限 |
| 429 | （可选 V1）计算频率限制 |

错误 JSON 格式：

```json
{
  "errors": ["Translation key or message"]
}
```

---

## 7. 数据模型

### 7.1 ER 关系

```
User ─┬─< MechboxCalculationRecord
      └─< MechboxFavoriteTool

User ──< MechboxFormulaTemplate (created_by)
              │
              ├──< MechboxTemplateVersion
              └──< MechboxCalculationRecord (optional)
```

### 7.2 表结构（已实现 migration）

| 表名 | 用途 |
|------|------|
| `mechbox_formula_templates` | 企业公式模板 |
| `mechbox_template_versions` | 模板变更快照 |
| `mechbox_calculation_records` | 用户计算历史 |
| `mechbox_favorite_tools` | 用户收藏（`user_id` + `tool_id` 唯一） |

### 7.3 公式模板 JSON 字段约定

**`formula`**（必填）：

```json
{
  "outputs": {
    "force_kn": "torque_nm / (nut_factor * diameter_m)",
    "safety_factor": "yield_mpa / stress_mpa"
  }
}
```

- 表达式仅允许：数字、标识符（输入变量名）、`+ - * / **`、括号
- 最大长度 500 字符（`FormulaEvaluator::MAX_EXPRESSION_LENGTH`）
- 不允许函数调用、字符串、任意 Ruby/JS 执行

**`default_inputs`**：表单预填值  
**`output_schema`**：前端展示用（单位、标签、精度）

---

## 8. 权限与安全

### 8.1 Guardian 扩展（已实现）

| 方法 | 逻辑 |
|------|------|
| `can_use_mechbox?` | 插件启用 + 用户在 `mechbox_allowed_groups` |
| `can_manage_mechbox_templates?` | 可使用 MechBox +（admin 或 `mechbox_template_manager_groups`） |
| `can_use_mechbox_template?(template)` | 可使用 + 模板 `active` + `visible_to?` |

### 8.2 安全要求

| 项 | 要求 |
|----|------|
| 公式求值 | 禁止 `eval` / `instance_eval`；使用自研词法+递归下降解析器 |
| XSS | 输出字段 JSON 序列化；前端 `{{}}` 转义 |
| 授权 | 所有 API 经 `BaseController` 统一 `guardian` 检查 |
| 速率限制 | V1 对 `/calculate` 考虑 `RateLimiter`（如 60 次/分钟/用户） |
| 输入大小 | `inputs` JSON 不超过 64KB |

---

## 9. 站点设置

定义于 `config/settings.yml`：

| 设置键 | 类型 | 默认 | 说明 |
|--------|------|------|------|
| `mechbox_enabled` | bool | `false` | 插件总开关（client） |
| `mechbox_allowed_groups` | group_list | `0`（everyone） | 可使用 MechBox 的组 |
| `mechbox_template_manager_groups` | group_list | `3`（staff） | 可管理公式模板 |
| `mechbox_save_calculation_records` | bool | `true` | 是否允许保存记录（client） |
| `mechbox_max_records_per_user` | int | `500` | 每用户记录上限，0=不限制 |
| `mechbox_default_unit_system` | enum | `metric` | 默认单位制（client） |

---

## 10. 内置计算器

定义于 `CalculatorRegistry::BUILTIN_TOOL_IDS`（Ruby 服务端实现）：

| tool_id | 名称 | 输入 | 输出 |
|---------|------|------|------|
| `unit_converter` | 单位换算 | value, from_unit, to_unit | converted_value |
| `rss_calculation` | RSS 叠加 | values（数组或逗号分隔） | rss, count |
| `gear_ratio` | 齿轮比 | driver_teeth, driven_teeth, input_speed_rpm | ratio, output_speed_rpm |
| `bolt_clamp_load` | 螺栓预紧力 | torque_nm, nut_factor, nominal_diameter_mm | preload_n, preload_kn |
| `gdt_position` | GD&T 位置度 | deviation_x_mm, deviation_y_mm | position_diameter_mm |

### 10.1 扩展内置工具原则

1. 在 `BUILTIN_TOOL_IDS` 注册 `tool_id`
2. 实现 `calculate_<tool_id>` 类方法
3. 在 metadata 中补充 schema（可抽 `BUILTIN_METADATA` 常量）
4. 添加 RSpec 单元测试与请求测试
5. 添加 `config/locales` 错误文案

### 10.2 与 MechBox 工具映射（后续批次）

独立 MechBox 路由中的工程工具（如 `gear`、`bearing`、`bolt-preload` 等）按优先级分批接入，见 [14. 版本路线图](#14-版本路线图)。

---

## 11. 前端集成方案

### 11.1 推荐方案：原生 Discourse 插件前端

```
assets/javascripts/discourse/
  routes/mechbox-*.js
  controllers/mechbox-*.js
  templates/mechbox/
stylesheets/common|desktop|mobile/mechbox.scss
```

- 使用 FormKit 构建计算表单
- 使用 `@service siteSettings` 读取 `mechbox_*` 客户端设置
- API 调用 `ajax` / `discourseAjax` 访问 `/mechbox/api`

### 11.2 备选方案：嵌入 MechBox 构建产物

- `npm run build` 输出至 `public/mechbox-app/`
- Discourse 路由 `/mechbox/app/*` iframe 加载
- 通过 `postMessage` 传递 CSRF、用户信息
- **缺点**：双技术栈、SEO 与样式隔离差；仅作过渡

### 11.3 导航注册（plugin.rb 待补充）

```ruby
add_navigation_bar_item(
  name: "mechbox",
  customFilter: "canUseMechbox",
  before: "faq",
)
```

---

## 12. 非功能需求

| 类别 | 要求 |
|------|------|
| **性能** | metadata 接口 < 200ms；单次计算 < 100ms（内置工具） |
| **兼容性** | 与当前 Discourse main 分支 Ruby 3.x / Rails 8 一致 |
| **国际化** | 用户可见字符串走 I18n；先 `en` + `zh_CN` |
| **可测试性** | 每个 API 有 request spec；CalculatorRegistry / FormulaEvaluator 有 model/lib spec |
| **可维护性** | 业务逻辑放 service 对象（后续可抽 `app/services/discourse_mechbox/`） |
| **Lint** | 变更文件通过 `bin/lint` |

---

## 13. 实现状态

截至 **2026-07-10**：

| 组件 | 状态 |
|------|------|
| `plugin.rb`、Engine、routes | ✅ 已有 |
| `config/settings.yml` | ✅ 已有 |
| DB migration + 4 models | ✅ 已有 |
| 3 serializers | ✅ 已有 |
| `CalculatorRegistry` | ✅ 已有（5 工具） |
| `FormulaEvaluator` | ✅ 已有 |
| `GuardianExtension` | ✅ 已有 |
| Controllers（6 个） | ❌ 缺失 |
| `config/locales/*` | ❌ 缺失 |
| 前端 routes/templates/controllers | ❌ 缺失 |
| stylesheets | ❌ 缺失 |
| RSpec / QUnit 测试 | ❌ 缺失 |
| README / 需求文档 | ✅ 本文档 |

**结论**：当前**不可启用**于生产；启用会导致 `require_relative` 加载控制器失败。

---

## 14. 版本路线图

### Phase 0 — 骨架补齐（1–2 周）

- [ ] 实现全部 Controllers + `BaseController`
- [ ] `config/locales/server.en.yml`、`server.zh_CN.yml`、`client.*`
- [ ] 基础 Ember 首页 + 单工具页 + 记录列表
- [ ] stylesheets 基础布局
- [ ] Request specs 覆盖全部 API
- [ ] 管理端启用说明

### Phase 1 — MVP 发布（2–3 周）

- [ ] 5 个内置工具完整 UI
- [ ] 收藏 + 记录 CRUD
- [ ] 模板 CRUD + 版本记录
- [ ] 导航入口 + 权限联调
- [ ] QUnit 接受测试（核心流程）

### Phase 2 — 工具扩展（4–6 周）

- [ ] 从 MechBox 迁移高频工具（螺栓、轴承、轴、单位等）
- [ ] 前端计算模块 + 可选服务端校验
- [ ] 记录搜索与分页

### Phase 3 — 社区联动（2 周）

- [ ] 计算结果 → 话题草稿
- [ ] 话题内 MechBox 结果卡片（onebox 或自定义 BBCode）

### Phase 4 — 高级能力（持续）

- [ ] 尺寸链 / Monte Carlo（MechBox 核心）
- [ ] 导出 PDF/Excel
- [ ] 速率限制与审计日志

---

## 15. 验收标准

### 15.1 V0.1 MVP 验收清单

| # | 项 | 通过标准 |
|---|-----|----------|
| 1 | 插件加载 | `mechbox_enabled=true` 后 Discourse 正常启动，无 boot 错误 |
| 2 | 权限 | 非授权用户访问 `/mechbox` 与 API 返回 403 |
| 3 | 计算 | 5 个内置工具各至少 1 组用例与手工验算一致 |
| 4 | 模板 | 管理员创建模板后，授权组成员可计算并落库 |
| 5 | 记录 | 保存、列表、详情、删除全流程可用；超限有明确提示 |
| 6 | 收藏 | 添加、列表、删除正确 |
| 7 | 安全 | FormulaEvaluator 拒绝 `eval`、超长表达式、未知变量 |
| 8 | 测试 | `bin/rspec plugins/discourse-mechbox` 全绿 |
| 9 | Lint | `bin/lint plugins/discourse-mechbox` 无新增错误 |
| 10 | 文案 | 中英文错误提示可切换 |

### 15.2 回归测试建议用例

**齿轮比**：driver=20, driven=40, input_speed=1000 → ratio=2.0, output_speed=500  
**RSS**：values=[3,4] → rss=5  
**螺栓**：torque=50, k=0.2, d=12 → preload_n≈20833.33  

---

## 16. 附录

### 16.1 目录结构（目标态）

```text
plugins/discourse-mechbox/
├── plugin.rb
├── README.md
├── docs/
│   └── REQUIREMENTS.md          # 本文档
├── config/
│   ├── routes.rb
│   ├── settings.yml
│   └── locales/
│       ├── server.en.yml
│       ├── server.zh_CN.yml
│       ├── client.en.yml
│       └── client.zh_CN.yml
├── app/
│   ├── controllers/discourse_mechbox/
│   ├── models/discourse_mechbox/
│   ├── serializers/discourse_mechbox/
│   └── services/discourse_mechbox/   # 可选
├── lib/discourse_mechbox/
├── db/migrate/
├── assets/
│   ├── javascripts/discourse/
│   └── stylesheets/
├── spec/
└── test/javascripts/acceptance/
```

### 16.2 待实现文件清单（Phase 0）

```
app/controllers/discourse_mechbox/base_controller.rb
app/controllers/discourse_mechbox/calculations_controller.rb
app/controllers/discourse_mechbox/favorites_controller.rb
app/controllers/discourse_mechbox/metadata_controller.rb
app/controllers/discourse_mechbox/records_controller.rb
app/controllers/discourse_mechbox/templates_controller.rb
stylesheets/common/mechbox.scss
stylesheets/desktop/mechbox.scss
stylesheets/mobile/mechbox.scss
```

### 16.3 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| V0.1 | 2026-07-10 | 初稿：基于现有代码与 MechBox 项目整理 |
| V0.2 | 2026-07-10 | 补充 API、权限、路线图、实现状态、验收标准 |

---

**维护者**：Mechbox 团队  
**插件路径**：`plugins/discourse-mechbox`
