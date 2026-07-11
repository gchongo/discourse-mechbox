# discourse-mechbox

Discourse 插件：在论坛内集成 **MechBox（机械工具箱）**——工程计算、计算记录、工具收藏与企业公式模板。

## 状态

**Phase 0.5.4b（待生产验证）**：撤销会触发生产 502 的独立 `FeatureGate` 模块，改为在 `BaseController` 内直接实现 API 门禁。页面仍为占位内容，工具目录 UI 计划在 Phase 0.5.7 接入。

## 版本更新记录

插件版本号见 `plugin.rb` 头部 `version` 字段；下列为**增量交付步骤**（Phase 0.5.x），每步需生产 `rebuild` 验证后再进行下一步。

| 版本标记 | 日期 | 变更摘要 | 验证要点 |
|----------|------|----------|----------|
| `safe_skeleton` | 2026-07-11 | 缩回安全骨架：`lib/` 仅 `engine.rb`，2 个控制器；保留侧边栏与 `/mechbox` 占位页；修复 502 | 首页可开；`mode: safe_skeleton` |
| `phase0_5_1` | 2026-07-11 | 恢复 `api_capabilities.rb`；`metadata` 返回完整 `capabilities`（仅 `metadata` 为 enabled） | `GET /mechbox/api/metadata` 含 `api_version: 1` |
| `phase0_5_2` | 2026-07-11 | 恢复 `database_features.rb`；`status`/`metadata` 增加 `database_available` | 生产验证通过 |
| `phase0_5_3` | 2026-07-11 | 恢复 `tool_catalog.rb`；`metadata` 返回工具目录；新增 `mechbox_page_controller` 修复 `/mechbox` 硬刷新 404 | 生产验证通过 |
| `phase0_5_4` | 2026-07-11 | 尝试恢复独立 `feature_gate.rb` 并由 `BaseController` include | ❌ 生产出现 502；故障隔离到该新增模块/加载链 |
| `phase0_5_4b` | 2026-07-11 | 删除独立 `feature_gate.rb`，将同一门禁方法直接放入 `BaseController`，避免额外 autoload/include 链 | 待验证：`status.mode` 为 `phase0_5_4b`；论坛不 502 |
| `phase0_5_5` | — | 计划：`metadata_builder` + `metadata_controller` | 待做 |

完整分步计划见 [docs/PHASED_ROADMAP.md](docs/PHASED_ROADMAP.md)。

## 功能概览

- 内置计算器（单位换算、RSS、齿轮比、螺栓预紧力、GD&T 位置度等）
- 企业自定义公式模板（安全表达式求值 + 版本快照）
- 用户计算历史与工具收藏（PostgreSQL 持久化）
- 基于 Discourse 用户组的访问控制

## 关联项目

完整功能的独立 Web 应用见仓库内 [`MechBox/`](../../MechBox/)（Vue 3）。插件分阶段与之对齐，统一账号与权限。

## 文档

| 文档 | 说明 |
|------|------|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | 需求规格、数据模型、路线图与验收标准 |
| [docs/API.md](docs/API.md) | REST API 端点清单与扩展说明 |
| [docs/TOOL_ID_CONVENTIONS.md](docs/TOOL_ID_CONVENTIONS.md) | 单工具 `tool_id` 接入约定 |
| [docs/PHASED_ROADMAP.md](docs/PHASED_ROADMAP.md) | 分阶段交付路线图 |
| [docs/BOOT_FAILURES.md](docs/BOOT_FAILURES.md) | 502 启动故障记录与恢复原则 |
| [MechBox/mechbox-project-requirements.md](../../MechBox/mechbox-project-requirements.md) | 独立 MechBox 产品原始需求（尺寸链等完整功能） |

## 站点设置

在 Discourse 管理后台搜索 **mechbox**：

- `mechbox_enabled` — 总开关（默认关闭）
- `mechbox_allowed_groups` — 允许使用的用户组
- `mechbox_template_manager_groups` — 公式模板管理员
- `mechbox_save_calculation_records` / `mechbox_max_records_per_user` — 记录保存策略
- `mechbox_default_unit_system` — 默认单位制（metric / imperial）

## API 前缀

挂载于 `/mechbox/api`（需登录且具备 MechBox 权限）。端点列表见需求文档 [第 6 节](docs/REQUIREMENTS.md#6-api-规格)。

## 开发

```bash
# 在 Discourse 根目录
bin/rake db:migrate
bin/rspec plugins/discourse-mechbox
pnpm qunit-test plugins/discourse-mechbox/test/javascripts/acceptance/mechbox-test.js
bin/lint plugins/discourse-mechbox
```

## 迁移与兼容策略

- 已新增规范化迁移，统一历史版本中字段默认值、`bigint` 外键类型与高频查询索引。
- 对既有表采用幂等变更，不会删除历史记录，仅做结构标准化。
- 未实现能力继续通过 `capabilities` 声明与 `501` 返回显式门禁，避免客户端误调用。

## 许可证

与 Discourse 主项目一致。
