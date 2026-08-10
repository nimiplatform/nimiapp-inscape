# Inscape × Nimi App Access 对接审计报告(第一阶段:只读审计)

- 日期:2026-08-08
- 范围:`nimiapp-inscape` 全仓库只读盘点 + 平台参考仓库 `/Users/snwozy/nimi-realm/nimi`(branch `spec-4`)只读核对。本阶段未修改任何源文件。
- 参照:canonical 参考 App `nimi/apps/tester`、真实产品适配范例 `nimi/apps/zhiyu`。
- 下文 `⟨nimi⟩` 指代 `/Users/snwozy/nimi-realm/nimi`。

## 0. 结论摘要

1. **inscape 当前整条 nimi 消费链都是旧 first-party/workspace-app 形态**,且仓库自己的红线门已经红了:`pnpm run check:redlines` 实跑 FAIL —— `src/shell/infra/inscape-bootstrap.ts` 命中 `IS-AUTH local-first-party-forbidden`(`createNimiLocalFirstPartyRuntimeAccountCaller`,规则见 `scripts/check-redlines.mjs:55-58`,命中点 `src/shell/infra/inscape-bootstrap.ts:4,46`)。适配不是可选优化,是仓库转绿的前提。
2. **任务简报中的"恰好 14 行操作"与 spec-4 实况不符**:生产 map `⟨nimi⟩/runtime/internal/localappop/contract.go:91-112` 实为 **20 行**(5 Base + 15 AppAccess,AppAccess 覆盖 **4 个** domain:`realm.data` / `runtime.consume` / `agent.local` / `agent.configure`)。以仓库为准。
3. **inscape 需要的最小 domain 集 = 仅 `runtime.consume`**(AI 文本生成)。storage JSON 与 App AIConfig 是 Base 操作无需声明;inscape 不用 realm、不自建也不消费 agent(产品权威禁止开放聊天面,`.nimi/spec/inscape/canonical/product.authority.yaml` IS-PROD-05 对应行)。
4. **npm 已发布包不含 App Access 表面**(实拆 tarball 验证,见 §4.4):`@nimiplatform/sdk@0.6.0` / `kit@0.2.0` / `app-tools@0.1.3` 均为旧表面。外部仓库目前只能 `link:` 到 sibling 平台仓库并消费其 **dist**(dist 已存在于平台工作树)。
5. **Tauri 不是被接纳的本地开发载体**(`⟨nimi⟩/app-tools/scripts/dev-shell.mjs:324-332`),inscape 必须新增 Electron 壳(`src-electron/`)走 `nimi-app dev --shell electron`;`src-tauri` 的去留是留给用户的决策点 D1。
6. inscape 的关系型 SQLite(CHECK + 0o600 + quarantine)是**产品权威**(`.nimi/spec/inscape/canonical/privacy.authority.yaml:21,61`、`data-model.authority.yaml:24,73`),不能换成 runtime `storage.json.*`;新契约下经 Electron 主进程 `appCommandHandlers` 继续自管,反而可去掉对 runtime 取数据根的依赖。

## 1. 现状盘点

### 1.1 依赖与消费方式(`package.json`)

| 项 | 现状 | 证据 |
|---|---|---|
| `@nimiplatform/sdk` | `link:../../nimi/sdks/typescript`(sibling 源码链) | `package.json:34` |
| `@nimiplatform/kit` | `link:../../nimi/kit` | `package.json:33` |
| vite alias | 把 `@nimiplatform/sdk` `/ai` `/runtime` `/runtime/generated` `/types`、`@nimiplatform/kit/*` 全部直指平台仓库**源文件**编译,绕过 package exports | `vite.config.ts:13-15,44-57`;fs.allow 放开整个 nimi 仓库 `vite.config.ts:74-81` |
| `@nimiplatform/app-tools` | **无** | `package.json:42-57` |
| electron / esbuild / tsx | **无** | `package.json:42-57` |
| Tauri | `@tauri-apps/api ^2.9.1` + `@tauri-apps/cli ^2.11.2`;Rust 侧 `nimi-shell-tauri` path 依赖 | `package.json:35,46`;`src-tauri/Cargo.toml:31` |
| 启动方式 | `dev` = vite(127.0.0.1:1431 strictPort)+ `dev:shell` = `tauri dev`;无 `nimi-app dev` 入口 | `package.json:12-14`;`src-tauri/tauri.conf.json:8` |
| npm 发布可用性 | sdk/kit/app-tools 已发布版本均为 App Access 之前的内容(实测,§4.4) | 本报告 §4.4 |

### 1.2 Manifest(`nimi.app.yaml`,全文 13 行)

- `profile: workspace-app`(`nimi.app.yaml:3)—— 新契约第三方独立发布应为 `standalone`(参照 `⟨nimi⟩/apps/tester/nimi.app.yaml:3`)。
- `permissions: declared_nimi_api_scopes:`(`nimi.app.yaml:5-13`)—— 退休权限平台的遗留词汇,必须替换为 `app_access`。
- 无 `local_development` 段。

### 1.3 壳与 bridge

- Tauri 主进程:`src-tauri/src/main.rs:130-149` 注册 `nimi_shell_tauri::capabilities`(oauth / runtime_bridge unary+stream / session_logging)+ 自有 `inscape_space_{load,save,clear}`;`configure_runtime_bridge_env` 默认 `NIMI_RUNTIME_BRIDGE_MODE=RUNTIME`(`src-tauri/src/main.rs:117-121`)。
- renderer 引导:`src/main.tsx:12` `installNimiShellRuntimeBridge()`(kit 渲染桥,Electron 下同样适用,见 §4.2)。
- **无 Electron 主进程**,自然也没有 `registerNimiElectronAppBridge` 用法 —— 这是全新引入项,不是"换"。

### 1.4 renderer 侧 nimi 表面调用点(全枚举,rg 结果)

| # | 调用点 | 位置 | 性质 |
|---|---|---|---|
| C1 | `createNimiLocalFirstPartyRuntimeAccountCaller` | `src/shell/infra/inscape-bootstrap.ts:4,46-50` | **旧 first-party 表面,红线 FAIL** |
| C2 | `createNimiRuntimeFullAppRegistration` | `src/shell/infra/inscape-bootstrap.ts:6,124-135` | 旧 first-party 注册流 |
| C3 | `createNimiRuntimeAppSessionMetadataProvider` + `capabilities: ['ai.spend.meter']` | `src/shell/infra/inscape-bootstrap.ts:43,137-156` | 旧 first-party app-session |
| C4 | `transport: { type: 'tauri-ipc', commandNamespace: 'runtime_bridge' }` | `src/shell/infra/inscape-bootstrap.ts:116-121` | Tauri IPC 传输,Electron 下不存在 |
| C5 | `createNimiClient({ appId, runtime, realm:false, app:false, permissions:false })` | `src/shell/infra/inscape-bootstrap.ts:158-174` | 旧客户端配置(`permissions` 词汇) |
| C6 | `runtime.account.getAccountSessionStatus` | `src/shell/infra/inscape-bootstrap.ts:73,148` | 旧 account 投影 |
| C7 | `runtime.account.beginLogin` / `completeLogin`(browser broker) | `src/shell/features/auth/inscape-auth-adapter.ts:65-71,98-110` | 旧 first-party 登录面 |
| C8 | kit `DesktopShellAuthPage` 登录页 | `src/shell/features/auth/inscape-login-page.tsx:17-45` | 随 C7 整体退役 |
| C9 | `client.runtime.generated.getAppStorage({appId})` 取 `durableDataRoot` | `src/shell/persistence/runtime-app-storage-adapter.ts:170-181` | 旧 generated runtime 面 |
| C10 | Tauri `invoke('inscape_space_{load,save,clear}')` | `src/shell/persistence/runtime-app-storage-adapter.ts:54,121,156`;Rust `src-tauri/src/persistence.rs:702-735` | 自有 SQLite 缝,迁 Electron `appCommandHandlers` |
| C11 | `@nimiplatform/sdk/ai` 全家桶:`createNimiRuntimeAISchedulingClient` peek 门、`createNimiRuntimeAIModel`、`runNimiTextGenerate`、AIConfig evidence | `src/shell/ai/inscape-runtime-ai-client.ts:8-19,149-170,219-246` | 旧 first-party AI 面 |
| C12 | App AIConfig 存浏览器 localStorage(`createNimiAIConfigStore`)+ scopeRef(ownerId 材料)+ 修复/隔离 | `src/shell/ai/inscape-ai-config.ts:21-24,45-49,112-150` | 与新 `aiConfig.*` Base 操作冲突 |
| C13 | first-run AIConfig bootstrap(已 fail-closed 死链,'not-initialized') | `src/shell/ai/inscape-ai-config-bootstrap.ts:46-65` | 应删除 |
| C14 | `getDaemonStatus` / `oauthListenForCode` / `openExternalUrl` / `focusMainWindow` re-export + `inscapeTauriOAuthBridge` | `src/shell/bridge/index.ts:5-17,26-45` | 随登录面退役而清理 |
| C15 | `hasTauriRuntime` / `invokeTauri`(renderer 日志 sink `log_renderer_event`) | `src/shell/infra/renderer-log.ts:1,78` | 迁 Electron 后换传输 |
| C16 | `NIMI_WEB_URL` 默认 `http://localhost:3000`(登录页 webBaseUrl) | `src/shell/bridge/inscape-runtime-defaults.ts:29-31` | 随登录面退役 |
| C17 | AI 消费方 7 处产品表面(只调 `createInscapeRuntimeAiClient`,不触平台面) | `src/product/today/todays-read.tsx:16`、`decision-aid.tsx:19`、`reflection-journal.tsx:26`、`src/product/relationship/dyad-insight.tsx:32`、`communication-rewrite.tsx:32`、`relationship-detail.tsx:29`、`src/product/self/self-mirror.tsx:18` | 接口保持不变即可 |
| C18 | `pickPersistenceClient` 非 Tauri 环境**静默**落 `InMemoryPersistenceAdapter` | `src/shell/routes/product-area.tsx:19-24` | 伪成功风险,须改 fail-closed |

### 1.5 姿态处理现状(对照"三项独立即时事实"纪律)

- 无 runtime-status 模块;bootstrap 失败把**原始错误字符串**全屏红字展示(`src/shell/app-shell/auth-provider.tsx:18-26`),无重试按钮 —— 违反"typed unavailable + 同 Host 重试"与"终端 UI 不显示机器码/技术细节不折叠"纪律。
- 未发现 session-loss 自杀式处理(好),但也无任何 access 丢失后的姿态处理(缺)。
- 身份门:`ProductArea` 仅以 `user?.id` 存在性 gate(`src/shell/routes/product-area.tsx:27-29`),accountId 不进持久化 —— 迁到 `currentUser.get()` 的 `{handle,displayName,avatarUrl}` 无数据迁移负担。

## 2. 残留清单(全仓库扫描,`node_modules` 除外)

| 词汇/表面 | 结果 | 证据 |
|---|---|---|
| `permissions`(manifest 键) | **1 处,必删** | `nimi.app.yaml:5-13` |
| `permissions: false`(SDK 配置) | **1 处,随 C5 删除** | `src/shell/infra/inscape-bootstrap.ts:170` |
| `createNimiLocalFirstPartyRuntimeAccountCaller` | **1 处,红线 FAIL 中** | `src/shell/infra/inscape-bootstrap.ts:4,46`;规则 `scripts/check-redlines.mjs:55-58` |
| `SendAppMessage` / `agents.configure` / `localAgentId` / `onProtectedSessionFailure` / artifact put/read / voice 流 | **0 处** | 全仓 rg 无匹配(`src/product/today/today-prompts.ts:53` 的 "voice" 与 `src/product/relationship/rewrite-classifier.ts:14` 是产品文案/正则,非平台面) |
| durable agent handle 持久化 | **0 处**(无任何 agent 消费) | 全仓 rg |
| 直连 Realm URL/credential | **0 处**;红线规则已禁 `createRealmFetchTransport`/`credentials:'include'` | `scripts/check-redlines.mjs:69-73` |
| session-loss 自杀/Host 替换 | **0 处** | 全仓 rg |
| 权限平台词汇在 docs/spec | `docs/_archive/**`、`docs/authority-implementation-status.yaml:122`、`LICENSE:5,12`、`.nimi/spec/**` 中的 "permissions" 均指 **SQLite 文件权限 0o600** 或 MIT 许可行文,非权限平台;`_archive` 为历史快照,不动 | `src-tauri/src/persistence.rs:683-695`、`.nimi/spec/inscape/canonical/privacy.authority.yaml:61` |
| 登录 OTP 文案(`useEmailCodeInstead` 等) | 随登录页删除而清理 | `src/shell/locales/en.json:19-33`、`zh.json:19-32` |

## 3. 平台契约核对(以 spec-4 仓库为准)

### 3.1 操作契约(唯一生产 map)

`⟨nimi⟩/runtime/internal/localappop/contract.go:91-112`,**20 行**(简报说 14,已过期):

- Base(无需声明):`runtime.app-storage.json.{read,write,remove}`、`runtime.ai.app-config.{get,overwrite}`(:92-96)
- `realm.data`:`realm.world-core.{list,create}`(:97-98)
- `runtime.consume`:`runtime.ai.text-candidate.generate`(:99)
- `agent.local`:`runtime.agent.reference.list` + `runtime.agent.conversation.{open,turn.send,turn.interrupt,events.subscribe,snapshot.get}`(:100-105)
- `agent.configure`:`runtime.agent.ai-config.{get,overwrite}`、`runtime.agent.autonomy.snapshot.{get,update}`(实为 `autonomy.snapshot.get`/`autonomy.update`)、`runtime.agent.presentation.{snapshot.get,commit}`(:106-111)
- 支持 domain 全集由同一 map 派生:`IsSupportedDomain`(:146-156);app-tools 侧同集 `⟨nimi⟩/app-tools/lib/app-access-declaration.mjs:3-8`,未知条目 inert。

### 3.2 SDK 客户端(已直接读源核对)

- 入口:`createNimiClient({ localApp: { standardShell } })`(重载于 `⟨nimi⟩/sdks/typescript/root-client.ts:176-184`,config 仅允许 `localApp` 单键)。
- 命名空间:`auth.status` / `currentUser.get` / `storage.{readJson,writeJson,removeJson}` / `aiConfig.{get,overwrite}` / `realm.worldCore.{list,create}` / `ai.text.generateCandidate` / `agents.listReferences` / `agentConfigure.*` / `conversation.{open,send,interruptTurn,subscribe,snapshot}` —— `⟨nimi⟩/sdks/typescript/core/app/local-app-runtime-platform.ts:192-234`。
- `currentUser.get()` 只有 `{handle, displayName, avatarUrl}`(`:133-137`)。
- 会话态 union:`session-bound | action-required | revoked | project-changed | process-replaced | account-changed | runtime-restarted`,外加 `unavailable`(`:99-126`)。
- text unary 界:`MAX_TEXT_CANDIDATE_MESSAGES=8`、`MESSAGE_BYTES=32KiB`、`PROMPT_BYTES=64KiB`、`TOKENS=4096`(`:306-310`)。
- AIConfig intent 形状 `{capabilityContract, requiredFeatures, defaults?, route}`;**`route.oneofKind='local'` 可表达本地路由**;`assertNoAuthorityMaterial` 拒绝 owner/custody 字段 —— `⟨nimi⟩/sdks/typescript/core/app/local-app-runtime-platform-ai-config.ts:65-91`。tester 的 local intent 字面量:`capabilityContract: 'text.generate'`(`⟨nimi⟩/apps/tester/src/tester/app-access/app-access-probes.ts:90-96`)。
- 未声明 domain 的 typed denial:Runtime `ErrDomainUncovered`(`⟨nimi⟩/runtime/internal/localappop/admission.go:112-119`)→ gRPC `PermissionDenied` + `ReasonCode_LOCAL_APP_ACCESS_DENIED`(`⟨nimi⟩/runtime/internal/services/app/local_app_session_kernel.go:301-302`)→ 载体字符串 `local-app-access-denied`(`⟨nimi⟩/kit/shell/protected-local/src/carrier.rs:64,116`)。
- Runtime 不可达:`runtime-service-unavailable`(retryable,`carrier.rs:28,80`),SDK 投影 `state:'unavailable'`(`local-app-runtime-platform.ts:603-611,691`)。

### 3.3 Electron 壳与工具链

- 主进程:`registerNimiElectronAppBridge({ appId, allowedRendererUrls, ipcMain, appCommandHandlers? })`,精确键集校验,多余 authority 形字段(含已退役 `onProtectedSessionFailure`)即抛 `electron-local-app-bridge-input-forbidden` —— `⟨nimi⟩/kit/shell/electron/src/main/app-bridge.ts:20-31,133-153`;退役记录 `⟨nimi⟩/kit/CHANGELOG.md:28-32`。**`appCommandHandlers` 是 App 自有 IPC 的指定接缝**(`app-bridge.ts:24-30,155-187`)—— inscape 的 SQLite 命令与日志 sink 落在这里。
- preload:`installNimiElectronRuntimeBridge` 暴露 `window.__NIMI_ELECTRON_RUNTIME__`(`⟨nimi⟩/kit/shell/electron/src/preload/index.ts:39-41`);renderer `installNimiShellRuntimeBridge()` 在 Electron 下采纳该钩子(`⟨nimi⟩/kit/shell/renderer/src/bootstrap/runtime-bridge.ts:75-78`),`createNimiLocalAppStandardShellSurface()` 产出 SDK 所需 standardShell(`⟨nimi⟩/kit/shell/renderer/src/bridge/local-app.ts:196-244`)。
- CLI:`nimi-app dev --shell electron [--cdp-port]`(`⟨nimi⟩/app-tools/bin/nimi-app.mjs:100-113,135-137`);**Tauri 被拒绝**(`⟨nimi⟩/app-tools/scripts/dev-shell.mjs:324-332`);Desktop supervisor 经 presence 描述符 + `/v1/start` 拥有 vite/Electron 的构建启动(`dev-shell.mjs:22-105`)。
- sdk/kit dist:由 `⟨nimi⟩/scripts/with-workspace-surfaces.mjs` 包装构建(`⟨nimi⟩/scripts/lib/workspace-surfaces.mjs:27-42`);Desktop 开发 carrier 在 `pnpm dev:desktop` 期间自动 ensure+watch(`⟨nimi⟩/LOCAL_DEVELOPMENT.md:127-135`)。
- 端口:tester renderer 1468(`⟨nimi⟩/apps/tester/nimi.app.yaml:12`)、zhiyu 1472(`⟨nimi⟩/apps/zhiyu/nimi.app.yaml:10`);CDP 默认 desktop 9333 / zhiyu 9334 / tester 9335 / avatar 9336(`⟨nimi⟩/scripts/lib/dev-app-launch.mjs:5-26`)。
- tester 主进程对 dev renderer URL 做严格 loopback 校验(`⟨nimi⟩/apps/tester/src-electron/main.ts:133-156`),zhiyu 不做(`⟨nimi⟩/apps/zhiyu/src-electron/main.ts:119-127`)—— 照抄 tester。
- 姿态范例:zhiyu 的 typed unavailable 投影(`⟨nimi⟩/apps/zhiyu/src/shell/runtime/electron-runtime-unavailable.ts:1-6`)、同 Host 重试(`⟨nimi⟩/apps/zhiyu/src/shell/auth/auth-gate.tsx:54-56`)、折叠技术诊断(`⟨nimi⟩/apps/zhiyu/src/shell/auth/runtime-unavailable-page.tsx:45-61`);tester 的独立事实条("app-process / session / tooling / current-user",`⟨nimi⟩/apps/tester/src/tester/app-access/app-access-catalog.ts:238-244`)。

### 3.4 npm 发布现状(实拆 tarball)

`npm pack` 后 `tar tzf` 检查:`@nimiplatform/sdk@0.6.0`(2439 文件,内容为 `dist/realm/*`、`dist/runtime/generated/*` 旧表面)、`@nimiplatform/kit@0.2.0`(491 文件)、`@nimiplatform/app-tools@0.1.3`(7 文件)**均无任何 `local-app` / `electron/main` / `dev-shell` 路径**。即发布频道当前不可用于新契约;平台仓库内版本号已是 sdk 0.6.0 / kit 0.3.0 / app-tools 0.2.0(`⟨nimi⟩/sdks/typescript/package.json:3`、`⟨nimi⟩/kit/package.json:3`、`⟨nimi⟩/app-tools/package.json:3`),内容已超前于 npm。

## 4. 映射表(inscape 能力 → 处置)

| inscape 现状(证据) | 新契约对应 | 处置 |
|---|---|---|
| manifest `permissions.declared_nimi_api_scopes`(`nimi.app.yaml:5-13`)+ `profile: workspace-app`(:3) | `app_access` + `profile: standalone` + `local_development.electron.renderer_origin`(tester 模板) | **替换** |
| C1/C2/C3/C5 first-party bootstrap 全链(`inscape-bootstrap.ts:4-50,124-174`) | `createNimiClient({localApp:{standardShell}})`(§3.2) | **换新表面**,整链删除 |
| C6 账户投影 `getAccountSessionStatus` | `auth.status()` + `currentUser.get()`(handle 替代 accountId 做存在门) | **换新表面** |
| C7/C8/C16 应用内登录(broker、`DesktopShellAuthPage`、OAuth bridge、`NIMI_WEB_URL`)+ OTP 文案 | 新契约下第三方 App **无登录面**;参照 zhiyu 信息态页("账户操作仅由 Nimi Desktop 提供") | **删除**,姿态页新建 |
| `logoutInscapeRuntimeAccount` 拒绝桩(`inscape-bootstrap.ts:241-249`)及 auth-adapter 内同类 | 无对应(也没有需要 forbid 的面) | **删除** |
| C11 AI 生成(`sdk/ai` 全家桶) | `ai.text.generateCandidate`(domain `runtime.consume`);inscape 仅 1 system + 1 user,符合 8/32KiB/64KiB 界;`maxTokens` 须 clamp ≤4096 | **换新表面** |
| C12/C13 App AIConfig localStorage store + 修复/隔离 + 死链 bootstrap | `aiConfig.{get,overwrite}`(Base),intent `{capabilityContract:'text.generate', requiredFeatures:[], route:{oneofKind:'local', local:{}}}` —— 本地路由权威(runtime-ai r002)可表达 | **换新表面**,旧 store/bootstrap/repair 全删 |
| C9 取 runtime 数据根(`getAppStorage`) | 无对应(20 操作无"取数据根");持久化改为纯 App 本地,不再问 runtime | **删除该调用** |
| C10 InscapeSpace SQLite(Tauri 命令 + `persistence.rs` 844 行,9 表 CHECK + quarantine + 0o600) | 产品权威要求保留关系型 SQLite;新契约下经 Electron 主进程 `appCommandHandlers` 自管(§3.3),DB 落 Electron `app.getPath('userData')`;**不得**改用 `storage.json.*`(无法表达 per-row CHECK/quarantine,违反 data-model 权威) | **换新承载**(逻辑移植,权威不变) |
| C14 bridge re-export(daemon status / oauth / focus) | 无对应(守护生命周期归 Desktop;登录面已删) | **删除** |
| C15 renderer 日志 Tauri sink | Electron app command handler(同 `appCommandHandlers` 缝) | **换新承载** |
| C18 静默 InMemory fallback | 纪律禁止伪成功 | **改 fail-closed**(测试继续显式用 InMemory) |
| bootstrap 错误全屏红字(auth-provider.tsx:18-26) | typed unavailable + 信息态文案 + 同 Host 重试(zhiyu 模式,§3.3) | **重写姿态层** |
| Tauri 壳(`src-tauri/`,`main.rs:130-149`) | Tauri 非被接纳载体(§3.3) | **决策点 D1**(建议退役) |
| vite alias 编平台源码(`vite.config.ts:44-57`) | dist + package exports(`@nimiplatform/sdk/app` 等) | **删除 alias**,`platform-source-boundary.test.mjs` 重写 |
| realm / agents / voice / artifact | inscape 从未使用;新契约对应面**不声明、不接入** | 无行动 |

**产品缺口(新表面无对应,登记不自造)**:无功能性强缺口。两项登记:① `currentUser.get()` 无 `accountId`(仅 handle)—— inscape 只用 id 做存在门,实际无损;② 20 操作无"取 App 数据根"—— 持久化改纯 App 本地后不再需要。

## 5. 最小 domain 集

```yaml
app_access:
  - runtime.consume
```

- storage JSON 与 App AIConfig 是 Base 操作,无需声明(`contract.go:92-96`)。
- 不声明 `realm.data`:产品本地only,无 world-core 消费(现状 `createNimiClient` 已 `realm:false`,`inscape-bootstrap.ts:168`)。
- 不声明 `agent.local` / `agent.configure`:产品无 agent 消费,权威禁止开放聊天面。

## 6. 平台侧缺口/问题登记(只登记,不跨仓修)

- P1(平台 bug):`nimi-app create` 默认 scaffold 仍生成 `onProtectedSessionFailure`(`⟨nimi⟩/app-tools/lib/app-scaffold-profiles.mjs:253`),而 kit 运行时拒绝该字段(`app-bridge.ts:147-152`)—— **不要用 scaffold 产物起步**,照抄 tester `src-electron/main.ts`。
- P2(发布缺口):npm 已发布 sdk/kit/app-tools 均不含 App Access 表面(§3.4)—— 外部仓现阶段只能 `link:` sibling 仓 + dist。
- P3(认知缺口):第三方 standalone App 的**生产(非 dev)发行载体**在所读表面内未见(dev 仅 Desktop-supervised Electron);inscape 仍 Pre-Alpha,先登记。
- P4(已知平台问题,来自简报):strictPort 竞态 —— 端口冲突时 fail 并报告,不自动递增。

## 7. 工具链接入方案

**推荐方案(link + dist,与 tester/zhiyu 消费形态对齐)**:

1. `package.json` 新增 devDeps:`@nimiplatform/app-tools: link:../../nimi/app-tools`、`electron ^42.5.0`、`esbuild`;`@nimiplatform/{sdk,kit}` 保持 `link:` 但**改为消费 dist**(删 `vite.config.ts` 全部 `@nimiplatform/*` alias 与 `optimizeDeps.exclude`,靠 package exports 解析;exports 指向 dist,故要求 dist 新鲜)。
2. dist 新鲜度:inscape 脚本只做**检查**不构建(红线:nimi 仓只读);新鲜度由平台侧 `pnpm dev:desktop` watcher 保证(`LOCAL_DEVELOPMENT.md:127-135`),缺失/过期时脚本给出 typed 提示让开发者回平台仓准备。
3. 新增 `src-electron/main.ts`(照 tester:严格 loopback 校验 + `registerNimiElectronAppBridge` + `appCommandHandlers` 挂 inscape 自有命令)与 `src-electron/preload.cts`(`installNimiElectronRuntimeBridge`),配 `tsconfig.electron.json` + esbuild 打包 preload。
4. scripts 对齐 tester:`dev: "nimi-app dev --shell electron"`、`dev:renderer: vite --host 127.0.0.1 --port 1431 --strictPort`、`doctor/update` 透传。
5. **端口:沿用 1431**(已验证无冲突:平台仓内 1431 仅命中 archive 构建指纹哈希,非端口占用);`renderer_origin: http://127.0.0.1:1431`。journey CDP 端口选 **9337**(9333-9336 已被 desktop/zhiyu/tester/avatar 默认占用)。

备选方案:等平台发布 ≥ App Access 版本的 npm 包后切 published 依赖(P2 解除前不可用)。

## 8. 适配改造计划(第二阶段,分 checkpoint,每个 checkpoint 保持可构建 + focused 测试绿)

- **CP0 决策确认**:D1(Tauri 退役 vs 双壳)、D2(SQLite 绑定:better-sqlite3 vs node:sqlite)、D3(依赖方案确认 §7)。
- **CP1 依赖与工具链**:§7 全部;新增 `src-electron/`;`pnpm typecheck` 绿。
- **CP2 manifest**:`nimi.app.yaml` → standalone + `app_access: [runtime.consume]` + `local_development.electron.renderer_origin: http://127.0.0.1:1431`。
- **CP3 bridge + bootstrap 重写**:Electron main 注册 bridge;renderer `createNimiLocalAppStandardShellSurface` 客户端;删除 C1-C8、C14、C16;新建 runtime-status 模块(typed unavailable + 同 Host 重试 + 信息态文案);`auth-provider.tsx` 重写(不再全屏红字);`currentUser.get()` handle 门。
- **CP4 持久化移植**:SQLite 逻辑移植 Electron 主进程(`appCommandHandlers`),schema/CHECK/quarantine/0o600 逐条对拍 `persistence.rs`;adapter 去 `getAppStorage`;`pickPersistenceClient` fail-closed;`test/persistence.test.mjs`、`inscape-store.test.mjs` 绿。
- **CP5 AI 面切换**:`aiConfig.overwrite` local intent 首跑写入;`generateCandidate` 客户端替换 C11;删除 C12/C13 及 `test/ai-config-repair.test.mjs`(或重写对新表面);7 处产品表面(C17)接口不变回归绿。
- **CP6 文案与红线**:locale 清理(OTP 键)+ 新增姿态文案(无机器码、技术细节折叠);`scripts/check-redlines.mjs` 增补新禁词(legacy `permissions` 键、first-party 表面名);`platform-source-boundary.test.mjs` 重写;`pnpm check` 全绿。
- **CP7 文档同步**:`AGENTS.md` 架构表(Tauri→Electron、AI wording、Persistence 描述)与 provenance 段更新;`CLAUDE.md` 无需动(仅 managed block)。
- **CP8 真实 journey 验收**(前置:backend `pnpm dev`@3002 + `pnpm dev:desktop` 在跑、`@halliday` 已登录):`nimi-app dev --shell electron -- --cdp-port 9337` 启动;CDP 只挂本 App target;观察项 = 签入姿态 / `runtime.consume` positive(aiConfig overwrite + generateCandidate)/ 一个未声明操作(如 `realm.worldCore.list`)的 `local-app-access-denied` / 杀 source Runtime 进程 → typed unavailable → 同 Host 恢复 / 显式退出清理。诚实记 `not_observed`。报告写本仓(不进平台仓)。

## 9. 风险

- R1:`link:` 依赖要求 `nimi-realm` 目录布局;独立 clone 无法构建(P2 解除前无解,写进 README/AGENTS)。
- R2:sdk/kit dist 新鲜度依赖平台 watcher;inscape 侧只检查不构建,过期时给 typed 提示(不静默 fallback)。
- R3:better-sqlite3 在 Electron 下需 native rebuild;备选 `node:sqlite`(Electron 42 的 Node 版本是否免flag,CP1 实测)。
- R4:`test/platform-source-boundary.test.mjs:14-53`、`test/ai-config-repair.test.mjs:11` 断言的是**现架构**,CP5/CP6 必须同步重写,否则误红/误绿。
- R5:CP8 依赖外部环境(backend/desktop/登录态),人类登录动作不在本任务内;环境不齐则该 checkpoint 记 `not_observed` 而非伪成功。
- R6:删除登录面后,无 Desktop/未登录用户的首次体验完全依赖姿态页文案质量(CP3/CP6 重点)。
- R7:双壳并存期(D1 若选保留 src-tauri)维护两套 bridge,违背最小改动原则 —— 建议单壳。

## 10. 决策点(等用户确认)

- **D1**:`src-tauri` 整体退役、Electron 单壳(推荐)/ 暂留 src-tauri 双壳过渡。
- **D2**:SQLite 绑定 `better-sqlite3`(推荐,生态成熟)/ `node:sqlite`(零依赖,CP1 先验证 Electron 42 可用性)。
- **D3**:依赖消费按 §7 推荐(link + dist)执行?
- **D4**:本报告位置 `docs/nimi-app-access-audit.md` 是否符合项目惯例(docs/ 现仅 `_archive` + 一份 yaml)?

## 附录 A:引用自检(随机抽 5 条 re-grep)

| # | 引用 | 自检命令 | 结果 |
|---|---|---|---|
| 1 | `src/shell/infra/inscape-bootstrap.ts:46` 命中 first-party caller | `grep -n 'createNimiLocalFirstPartyRuntimeAccountCaller' src/shell/infra/inscape-bootstrap.ts` | 见下方实跑输出 ✅ |
| 2 | `contract.go:99` text-candidate 属 `runtime.consume` | `grep -n 'TextCandidateGenerate' contract.go` | 见下方实跑输出 ✅ |
| 3 | `local-app-runtime-platform.ts:306-310` text 界常量 | `grep -n 'MAX_TEXT_CANDIDATE' local-app-runtime-platform.ts` | 见下方实跑输出 ✅ |
| 4 | `local-app-runtime-platform-ai-config.ts:83` local route 校验 | `grep -n "oneofKind !== 'local'" local-app-runtime-platform-ai-config.ts` | 见下方实跑输出 ✅ |
| 5 | `dev-shell.mjs:324-332` Tauri 拒绝 | `grep -n -i 'tauri' dev-shell.mjs` | 见下方实跑输出 ✅ |

### 实跑输出

(此处为写报告时的真实 re-grep 输出,逐条对应上表)

```
1) src/shell/infra/inscape-bootstrap.ts
4:  createNimiLocalFirstPartyRuntimeAccountCaller,
46:  createNimiLocalFirstPartyRuntimeAccountCaller({

2) runtime/internal/localappop/contract.go
31:const AppOperationIDTextCandidateGenerate = "runtime.ai.text-candidate.generate"
42:	IngressTextCandidateGenerate
66:	OperationTextCandidateGenerate
99:	{IngressTextCandidateGenerate, OperationTextCandidateGenerate, AppOperationIDTextCandidateGenerate, AuthorityClassAppAccess, "runtime.consume"},

3) sdks/typescript/core/app/local-app-runtime-platform.ts
306:const MAX_TEXT_CANDIDATE_MESSAGES = 8;
307:const MAX_TEXT_CANDIDATE_MESSAGE_BYTES = 32 * 1024;
308:const MAX_TEXT_CANDIDATE_PROMPT_BYTES = 64 * 1024;
309:const MAX_TEXT_CANDIDATE_RESULT_BYTES = 256 * 1024;
310:const MAX_TEXT_CANDIDATE_TOKENS = 4096;

4) sdks/typescript/core/app/local-app-runtime-platform-ai-config.ts
83:	if (!route || (route.oneofKind !== 'local' && route.oneofKind !== 'cloud')) {

5) app-tools/scripts/dev-shell.mjs
324:  if (shell !== 'electron') {
... (324-332 拒绝非 electron shell,含 "Tauri is not an admitted local-development carrier")
```
