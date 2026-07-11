# MechBox tool_id 接入约定

本文档定义 `discourse-mechbox` 插件中**单工具**的增量接入规范。每个 `tool_id` 在业务上相互独立，但须遵循统一约定，以便复用平台层（API、权限、记录、收藏）。

## 1. tool_id 命名

| 规则 | 示例 |
|------|------|
| 全小写 snake_case | `gear_ratio`, `gdt_position` |
| 全局唯一 | 不可与内置、客户端、设计链 ID 重复 |
| 稳定不变 | 发布后避免重命名（DB 记录与收藏以 `tool_id` 为键） |

### 工具类型与 implementation 字段

| 类型 | `implementation` | 定义位置 |
|------|------------------|----------|
| Ruby 内置计算器 | `server_builtin` | `lib/discourse_mechbox/tool_catalog.rb` → `BUILTIN_TOOLS` + `CalculatorRegistry` |
| 企业公式模板 | `server_template` | `mechbox_formula_templates` 表，`tool_id` 前缀可为 `template_*` |
| 浏览器端计算器 | `client` | `ToolCatalog::CLIENT_TOOLS` + `ENABLED_CLIENT_TOOL_IDS` |
| 多工具设计链 | `design_chain` | `ToolCatalog::DESIGN_CHAIN_TOOLS`（**Phase 5 / projects 模块**） |

## 2. 输入/输出 schema

内置工具在 `BUILTIN_TOOLS` 中声明：

```ruby
"gear_ratio" => {
  category: "transmission",
  implementation: IMPLEMENTATION_SERVER_BUILTIN,
  inputs: [
    { key: "driver_teeth", type: "number", required: true },
  ],
  outputs: [
    { key: "ratio", type: "number" },
  ],
}
```

支持的 `type`：`number`, `integer`, `string`, `number_array`。

前端 `/mechbox/tools/:tool_id` 根据 `inputs` 动态渲染表单；`outputs` 用于结果展示与文档。

## 3. 国际化

| 层级 | 路径 | 用途 |
|------|------|------|
| 服务端（工具名/描述） | `config/locales/server.en.yml` → `mechbox.tools.<tool_id>.name` | API `metadata` / `tools` 响应 |
| 客户端（目录占位） | `config/locales/client.*.yml` → `mechbox.catalog.analysis_tools.<id>` | 首页分析类型目录（尚未接入计算） |
| 客户端（UI 文案） | `config/locales/client.*.yml` → `mechbox.*` | 按钮、错误提示等 |

## 4. API capabilities

`lib/discourse_mechbox/api_capabilities.rb` 声明平台级能力开关：

- `metadata`, `tools`, `calculate` — Phase 1/2 已启用
- `records_*`, `favorites`, `templates` — Phase 4 恢复
- `client_tools` — 有工具加入 `ENABLED_CLIENT_TOOL_IDS` 后启用
- `projects` — Phase 5 设计链

未启用能力的路由返回 `501`，由 `SkeletonController#not_implemented` 处理。

## 5. 前端路由

| 路由名 | URL | 说明 |
|--------|-----|------|
| `mechbox` | `/mechbox` | 首页目录 + 可用内置工具列表 |
| `mechbox-tool` | `/mechbox/tools/:tool_id` | 单工具计算页 |

仅 `available: true` 的工具应出现在可点击入口中。

## 6. 接入一个新内置工具（检查清单）

1. 在 `BUILTIN_TOOLS` 添加元数据（`inputs` / `outputs` / `category`）
2. 在 `CalculatorRegistry` 添加 `calculate_<tool_id>` 方法并注册到 `BUILTIN_TOOL_IDS`
3. 在 `server.en.yml` / `server.zh_CN.yml` 添加 `mechbox.tools.<tool_id>` 文案
4. 确认 `GET /mechbox/api/tools/<tool_id>` 返回正确 schema
5. 确认 `POST /mechbox/api/calculate` 可计算
6. 访问 `/mechbox/tools/<tool_id>` 完成端到端验证
7. 在 `spec/requests/discourse_mechbox/calculations_spec.rb` 补充请求测试

## 7. 接入一个新客户端工具（检查清单）

1. 在 `CLIENT_TOOLS` 添加 `category` + MechBox Vue `route`
2. 从 `MechBox/src/utils/` 移植计算模块到 `assets/javascripts/discourse/mechbox/tools/`
3. 将 `tool_id` 加入 `ENABLED_CLIENT_TOOL_IDS`
4. 在 `ApiCapabilities` 将 `client_tools.enabled` 设为 `true`（首个客户端工具接入时）
5. 将 `config/routes.rb` 中 `client_tools` 路由指向 `ClientToolsController`（替代 skeleton 501）
6. 前端视情况扩展 `mechbox/tool` 页或新建专用 GJS 组件

## 8. 设计链（不适用于本清单）

`shaft_system_chain`、`bolt_connection_chain` 等多工具串联能力属于 **projects 模块（Phase 5）**，见 [PHASED_ROADMAP.md](./PHASED_ROADMAP.md)。不要按单工具 checklist 接入。
