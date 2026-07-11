# MechBox 分阶段路线图

与 [TOOL_ID_CONVENTIONS.md](./TOOL_ID_CONVENTIONS.md) 配合，说明各阶段范围与当前状态。

## Phase 0 — 骨架稳定（已完成）

- 插件可加载，`/mechbox` 硬刷新不 404
- 设置页分类翻译、`route-map` 符合 Discourse 约定
- 未实现 API 统一返回 `501`

## Phase 1 — 平台 API（catalog only）

**状态：已完成**

- `GET /mechbox/api/metadata` — `ToolCatalog` + capabilities，DB 未迁移时模板/收藏返回空数组
- `GET /mechbox/api/tools` — 内置、客户端、设计链目录
- `GET /mechbox/api/tools/:tool_id` — 单工具 schema

加载范围见 `plugin.rb` → `PHASE1_LOAD_PATHS`（不含 records/favorites/templates 控制器）。

## Phase 2 — 首个单工具端到端

**状态：已完成（`gear_ratio`）**

- `POST /mechbox/api/calculate` / `calculate/validate`
- 前端 `mechbox.tool` → `/mechbox/tools/gear_ratio`
- 计算默认 `save_record: false`（记录保存留待 Phase 4）

其余 4 个内置工具（`unit_converter`, `rss_calculation`, `bolt_clamp_load`, `gdt_position`）已具备后端实现，按 [TOOL_ID_CONVENTIONS.md](./TOOL_ID_CONVENTIONS.md)  checklist 逐个点亮前端入口即可。

## Phase 3 — 逐个「点亮」单工具

**状态：进行中**

每增加一个 `tool_id`：

- 后端：已在 `CalculatorRegistry` 的工具只需确认 catalog 元数据
- 客户端工具：按 `ENABLED_CLIENT_TOOL_IDS` 机制逐个启用（见下节）
- 首页分析类型目录（18 项）：可保持「规划中」，待移植 MechBox 尺寸链编辑器后接入

## Phase 4 — 记录与收藏

**状态：待做**

恢复以下端点（替换 skeleton 501）：

- `records_controller`
- `favorites_controller`
- `templates_controller`（可选，与模板管理员并行）

前提：`db:migrate` 已执行，`DatabaseFeatures.available?` 为 true。

## Phase 5 — 设计链与 projects

**状态：明确推迟**

以下能力**不属于**单工具独立接入：

| tool_id | 说明 |
|---------|------|
| `shaft_system_chain` | 轴 → 轴承 → 键联动 |
| `bolt_connection_chain` | 预紧 → 螺栓组 → 焊缝联动 |

实现依赖：

- `projects` API（`GET/POST /mechbox/api/projects`）
- 多工具结果串联与链级报告
- 方案持久化（新表或扩展现有 `calculation_records`）

首页以 `status: deferred` 展示，API 继续返回 `501`。

## 客户端工具增量启用

当前 `ToolCatalog::ENABLED_CLIENT_TOOL_IDS = []`（全部未启用）。

启用步骤（每工具一次）：

1. 移植或 iframe 嵌入 `MechBox/src/utils/<module>.js`
2. `ENABLED_CLIENT_TOOL_IDS << "size_chain"`（示例）
3. `ApiCapabilities` 中 `client_tools.enabled = true`
4. `config/routes.rb` 将 client_tools 路由改回 `ClientToolsController`
5. 实现 `ClientToolsController#calculate` 调用移植后的 JS 或服务端校验

`metadata` 响应中 `client_tools[].available` 仅对已启用 ID 为 `true`。
