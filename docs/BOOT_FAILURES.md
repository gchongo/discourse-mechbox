# MechBox 启动故障记录（502 / 整站不可用）

本文档记录生产环境 `www.howhy.day` 上 discourse-mechbox 插件导致的 **502 Bad Gateway** 事故，供后续增量恢复时参考。

## 现象

| 浏览器表现 | 含义 |
|------------|------|
| `GET https://www.howhy.day/ 502 (Bad Gateway)` | Nginx 无法从 Discourse Ruby worker 获得正常响应 |
| `express-utils.js` Adobe 字体警告 | **无关**（浏览器扩展提示，可忽略） |
| 整站白屏、仅 `/mechbox` 异常 | 多为 **前端 Ember** 问题，通常 **不是** 首页 502 |

**结论：首页 502 = 后端 Ruby 进程在启动阶段失败，不是前端 JS 编译错误。**

## 已验证的对照实验

| 代码状态 | 论坛能否打开 |
|----------|--------------|
| **安全骨架**：`lib/` 仅 `engine.rb`，`app/` 仅 `base_controller` + `skeleton_controller` | ✅ 能开 |
| **Phase 1 批量恢复**：`lib/` 多个业务文件 + 额外控制器 + `Guardian.prepend` | ❌ 502 |
| 再次缩回安全骨架 + 保留侧边栏导航 | ✅ 能开 |

说明故障与 **MechBox 插件后端启动链路** 强相关，而非 Discourse 核心。

## 根因链

```
后台启用 mechbox_enabled
  → Discourse 加载 plugin.rb
  → Rails Engine 启动
  → 生产环境 Zeitwerk eager load（自动加载 lib/ 与 app/ 下所有 Ruby 文件）
  → 某一文件/常量/依赖加载失败
  → Ruby 进程崩溃
  → Nginx 返回 502
```

### 关键认知误区

> **不是** `plugin.rb` 里的 `require_relative` 决定了加载范围。

只要文件位于插件的 `lib/discourse_mechbox/` 或 `app/` 下，**生产环境 eager load 会尝试加载它们**，与是否在 `after_initialize` 中显式 require 无关。

因此从 `archived/` **一次性拷回大量业务代码** 等于把启动风险全部加回。

## 已确认的具体炸点

### 1. Zeitwerk eager load 范围过大（主因）

Phase 1 恢复时曾加回例如：

- `lib/discourse_mechbox/tool_catalog.rb`
- `lib/discourse_mechbox/api_capabilities.rb`
- `lib/discourse_mechbox/guardian_extension.rb`
- `lib/discourse_mechbox/user_preferences.rb`
- `lib/discourse_mechbox/feature_gate.rb`
- `app/services/discourse_mechbox/metadata_builder.rb`
- `app/controllers/discourse_mechbox/metadata_controller.rb`
- `app/controllers/discourse_mechbox/tools_controller.rb`

其中任一在 eager load 时失败，整站无法启动。

### 2. `concerns/` 目录命名冲突（已证实炸点之一）

路径 `lib/discourse_mechbox/concerns/feature_gate.rb` 违反 Rails Zeitwerk 对 `concerns` 目录的折叠规则：

| Zeitwerk 期望 | 代码实际定义 |
|---------------|--------------|
| `DiscourseMechbox::FeatureGate` | `DiscourseMechbox::Concerns::FeatureGate` |

生产 eager load 可能抛出 `Zeitwerk::NameError`。

**最初修复尝试**：移出 `concerns/`，改为 `lib/discourse_mechbox/feature_gate.rb`。该方案在 Phase 0.5.4 仍触发生产 502，因此已进一步改为直接在 `BaseController` 定义门禁方法，不再使用独立 mixin。

修除此项后仍出现 502，说明还有其他文件/依赖问题。

### 3. `Guardian.prepend` 扩大风险面

`reloadable_patch { Guardian.prepend(GuardianExtension) }` 在全局权限系统中注入逻辑。插件未稳定前，任何 Guardian 相关常量或 SiteSetting 问题都可能升级为启动级故障。

### 3.1 Phase 0.5.4 独立 FeatureGate 复发（2026-07-11）

对照结果：

- Phase 0.5.3（含 `ToolCatalog` 和 HTML 回退控制器）生产正常
- 唯一新增 `lib/discourse_mechbox/feature_gate.rb` 并在 `BaseController` 中 `include` 后，生产再次 502

因此故障范围已隔离到该模块的生产加载/include 链。没有服务器异常堆栈时，尚不能断言是 Zeitwerk 常量检查、`ActiveSupport::Concern` 初始化，还是加载时序；不要把推测写成确定根因。

处置：删除独立模块，把 `require_api_feature!` 作为 `BaseController` 私有方法直接实现（Phase 0.5.4b），减少一个 autoload 常量和 mixin 初始化环节。

### 4. `PLUGIN_NAME` 加载顺序（rebuild 阶段）

若 `require_relative "lib/discourse_mechbox/engine"` 早于 `PLUGIN_NAME` 定义：

```
uninitialized constant DiscourseMechbox::Engine::PLUGIN_NAME (NameError)
** INCOMPATIBLE PLUGIN **
```

会导致 `multisite:migrate` / rebuild 失败，容器起不来（同样表现为 502）。

**正确顺序**（当前 `plugin.rb` 已遵循）：

```ruby
module ::DiscourseMechbox
  PLUGIN_NAME = "discourse-mechbox"
end

require_relative "lib/discourse_mechbox/engine"
```

`engine.rb` 内应使用 `engine_name ::DiscourseMechbox::PLUGIN_NAME`。

### 5. 曾移除的其他风险项（历史）

| 项目 | 风险 |
|------|------|
| `get "/mechbox(/*rest)" => "list#latest"` | 可能干扰主应用路由表（已弃用） |
| 无 HTML 回退路由 | `/mechbox` 硬刷新 404（Ember 路由仅客户端生效） |
| 嵌套 Ember 路由 + 错误 `route` 名 | 插件启用时 JS 崩溃 → 白屏（非 502） |
| 重复/冲突数据库迁移 | rebuild 时 migrate 失败 |

**硬刷新修复（phase0_5_3）**：改用专用 `MechboxPageController#index`，对 HTML 请求 `render "default/empty"`（与 styleguide 插件相同模式），不再使用 `list#latest`。

## 不是原因的事项

- 侧边栏 `mechbox-navigation.js` initializer（最多影响前端，不导致首页 502）
- `/mechbox` 静态占位页模板
- 用户访问 `/mechbox` 时请求 API（仅影响该路由，不影响 `GET /`）
- 浏览器扩展字体加载提示

## 当前安全运行配置（2026-07-11）

- `plugin.rb`：仅 require `base_controller`、`skeleton_controller`，在 `after_initialize` mount API
- `lib/discourse_mechbox/`：仅 `engine.rb`
- `app/`：仅 2 个控制器
- `archived/`：业务代码存放处，**不参与** Zeitwerk autoload
- 前端：单路由 `/mechbox` + 侧边栏链接 + 静态占位页
- API：`/mechbox/api/status`、`/mechbox/api/metadata` 由 skeleton 提供；其余 501

## 救站流程（生产）

```bash
./launcher enter app
rails runner "SiteSetting.mechbox_enabled = false"
exit

# 同步代码后
./launcher rebuild app

# 确认首页正常后，后台启用插件，再 rebuild 一次
./launcher rebuild app
```

### 验证已部署骨架版

```bash
grep "safe_skeleton" plugins/discourse-mechbox/app/controllers/discourse_mechbox/skeleton_controller.rb
ls plugins/discourse-mechbox/lib/discourse_mechbox/   # 应只有 engine.rb
```

### 需要精确定位时收集日志

```bash
./launcher logs app | tail -100
# 或 rebuild 输出中搜索：mechbox, Zeitwerk, NameError, INCOMPATIBLE PLUGIN
```

## 增量恢复原则（避免复发）

1. **业务代码默认放 `archived/`**，不放进 `lib/` / `app/` 直至单步验证通过
2. **每次只恢复一个小模块**，每次 `rebuild` 验证论坛能开
3. **禁止**在 `lib/` 下使用 `concerns/` 目录名
4. **`PLUGIN_NAME` 必须先于 `require engine`**
5. 启用插件后 **必须第二次 rebuild**（Discourse 仅在启用时编译插件 JS）
6. `Guardian.prepend` 延后到 catalog API 稳定后再加

详见 [PHASED_ROADMAP.md](./PHASED_ROADMAP.md) 更新后的分阶段计划。
