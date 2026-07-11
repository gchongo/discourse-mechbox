# discourse-mechbox

Discourse 插件：在论坛内集成 **MechBox（机械工具箱）**——工程计算、计算记录、工具收藏与企业公式模板。

## 状态

**增量交付模式**：平台 API（metadata/tools）与首个内置工具 `gear_ratio` 端到端已可用；其余工具、记录/收藏、设计链按 [docs/PHASED_ROADMAP.md](docs/PHASED_ROADMAP.md) 分批接入。

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
