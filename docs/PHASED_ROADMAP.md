# MechBox 分阶段路线图

与 [TOOL_ID_CONVENTIONS.md](./TOOL_ID_CONVENTIONS.md)、[BOOT_FAILURES.md](./BOOT_FAILURES.md) 配合。

> **当前运行模式：安全骨架（safe_skeleton）**  
> 业务实现位于 `archived/`，按下面步骤**一次只恢复一小块**，每步 rebuild 验证。

## Phase 0 — 骨架稳定 ✅ 当前

- 插件可加载，论坛不因插件 502
- `/mechbox` 单路由 + 侧边栏「机械工具箱」链接
- `GET /mechbox/api/status`、`GET /mechbox/api/metadata`（skeleton 静态 JSON）
- 其余 API 统一 `501`
- `lib/` 仅 `engine.rb`；`app/` 仅 2 个控制器

**验收**：`https://站点/` 可开；侧边栏有 MechBox；`/mechbox/api/status` 返回 `mode: safe_skeleton`。

---

## Phase 0.5 — 平台 API（catalog only）⏳ 下一步

**目标**：恢复工具目录 API，**不**引入 DB 模型、Guardian 补丁、计算端点。

每步单独 commit + 服务器 rebuild 验证。

| 步骤 | 动作 | 验证 |
|------|------|------|
| 0.5.1 | 恢复 `api_capabilities.rb` → `lib/`（**勿用 concerns/**） | ✅ 生产验证通过 |
| 0.5.2 | 恢复 `database_features.rb` | ✅ 生产验证通过 |
| 0.5.3 | 恢复 `tool_catalog.rb`；修复 `/mechbox` HTML 硬刷新 | ✅ 代码已合入，待生产 rebuild 验证 |
| 0.5.4 | 恢复 `feature_gate.rb` 为 `lib/discourse_mechbox/feature_gate.rb` | rebuild 成功 |
| 0.5.5 | 恢复 `metadata_builder.rb` + `metadata_controller`；路由 `metadata#show` | `GET /mechbox/api/metadata` 有 catalog |
| 0.5.6 | 恢复 `tools_controller`；路由 `tools#index` / `tools#show` | `GET /mechbox/api/tools` 有 5 个内置工具 |
| 0.5.7 | 前端 `/mechbox` 从 metadata 渲染工具列表（无子路由） | 页面显示目录 |
| 0.5.8 | 恢复 `user_preferences.rb`（metadata 依赖） | metadata 含 preferences |
| 0.5.9 | 恢复 `guardian_extension.rb` + `Guardian.prepend` | rebuild + 权限正常 |

**禁止在本阶段恢复**：`CalculatorRegistry`、`calculations_controller`、AR 模型、记录/收藏。

---

## Phase 1 — 首个单工具端到端（`gear_ratio`）

**状态：待做**（`archived/` 中已有实现）

- `POST /mechbox/api/calculate` / `calculate/validate`
- 前端子路由 `/mechbox/tools/gear_ratio`（扁平路由，无嵌套）
- 计算默认 `save_record: false`

| 步骤 | 动作 |
|------|------|
| 1.1 | 恢复 `calculator_registry.rb`，启用 `calculate` capability |
| 1.2 | 恢复 `calculations_controller` |
| 1.3 | 前端 `mechbox-tool` 单页（避免 `concat`/动态 helper） |
| 1.4 | 验收：齿轮比可算、论坛仍稳定 |

其余 4 个内置工具按 [TOOL_ID_CONVENTIONS.md](./TOOL_ID_CONVENTIONS.md) 逐个「点亮」。

---

## Phase 2 — 逐个点亮单工具

每增加一个 `tool_id`：

- 确认 `ToolCatalog` + `CalculatorRegistry` 已有实现
- 前端增加对应入口（或共用通用 tool 页）
- 客户端工具：`ENABLED_CLIENT_TOOL_IDS` 机制逐个启用

分析类型目录（18 项）保持「规划中」，待尺寸链编辑器移植。

---

## Phase 3 — 记录与收藏

**前提**：`db:migrate` 成功，`DatabaseFeatures.available?` 为 true。

恢复 `records_controller`、`favorites_controller`；可选 `templates_controller`。

---

## Phase 4 — 设计链与 projects（明确推迟）

| tool_id | 说明 |
|---------|------|
| `shaft_system_chain` | 轴 → 轴承 → 键联动 |
| `bolt_connection_chain` | 预紧 → 螺栓组 → 焊缝联动 |

依赖 `projects` API 与方案持久化。首页以 `deferred` 展示，API 返回 `501`。

---

## 部署检查清单（每次上线）

- [ ] `PLUGIN_NAME` 在 `require engine` 之前定义
- [ ] `lib/discourse_mechbox/` 无 `concerns/` 目录
- [ ] 新增 Ruby 文件后本地/CI `bin/lint` 通过
- [ ] 先 `mechbox_enabled = false` rebuild，再启用，再 rebuild
- [ ] 容器内 `grep safe_skeleton` 或对应 phase 标记与预期一致
- [ ] 首页 + `/mechbox` + 一个 API 抽样请求正常

---

## 客户端工具增量启用

当前 `ToolCatalog::ENABLED_CLIENT_TOOL_IDS = []`（`archived/` 内配置）。

启用步骤（每工具一次）见原 Phase 3 文档；`client_tools` capability 默认保持 `false`。
