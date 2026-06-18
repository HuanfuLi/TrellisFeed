# Milestone v1.7 — Project Summary

**Generated:** 2026-06-18  
**Purpose:** 回归开发、团队 onboarding 与项目复盘  
**Status:** 进行中；Phase 54、55 已完成，Phase 55.1 接近收尾，Phase 56 已规划，Rewards 尚未开始

---

## 1. Project Overview

Trellis（原 EchoLearn）是一款 local-first 的 AI 个性化学习应用。它把问答、知识图谱、信息流、间隔复习和可视化 Trellis 花园连接起来，支持 OpenAI、Claude、Gemini 与本地 OpenAI-compatible 模型。

v1.6 已于 2026-05-20 发布，交付了过滤器重构、可信图谱编辑、检索/收藏/概念恢复、播客控制、Provider 隐私边界与非强迫式交互守卫。当前 v1.7 的目标是：

- 清理 v1.4–v1.6 累积的缺陷和技术债。
- 调整过滤、推荐、信息流与 embedding 机制。
- 通过真机测试修复 Android WebView 交互和性能问题。
- 完成全屏 UI、动画、导航和文档审计。
- 最后建设用 fruit credits 购买主题、宠物和花园装饰的 cosmetic rewards shop。

当前实际交接点：

- Phase 54、55 已完成并有验证记录。
- Phase 55.1 的原始四个真机问题均已通过设备 UAT；扩展问题中只剩 Planner Trellis 离屏 plain-SVG 性能修复尚待一次设备复测。
- Ask 输入栏随键盘平滑移动被明确接受为 won't-fix：WebView 无法提供 IME 逐帧进度，可靠方案需要原生 `WindowInsetsAnimation` Capacitor bridge。
- Phase 56 已完成 Context、Research、UI-SPEC 和 5 份 PLAN，但还没有执行。
- Phase 57–59（Rewards）未开始。

## 2. Architecture & Technical Decisions

- **技术栈：** React 19、TypeScript 5.9、Vite 7、Tailwind CSS 4、Capacitor 8；UI 主要使用 inline styles + CSS variables。
- **Local-first：** 用户数据留在设备，不依赖后端；Provider 请求边界由 payload golden tests 和结构测试保护。
- **最终存储实现：** 重型/增长型数据已统一迁移到 `IndexedDBBackend`，Web 与 native WebView 共用；运行时由内存 mirror 提供同步读取，启动时先 hydrate，再首屏渲染。旧函数名仍有 `*FromSQLite`，部分早期 Phase 55 文档也仍写 SQLite/WASM，但当前代码事实是 IndexedDB。
- **轻量偏好仍在 localStorage：** settings、开发模式、少量启动关键配置等继续保留，避免主题闪烁并保持同步启动。
- **Embedding：** 会话内按 text + model 缓存，避免同一 ask 流程重复 embedding；语料记录自身的向量仍持久化。
- **过滤器：** 最终采用 RAW-ARGMAX malicious gate。恶意判断只比较 raw/context-free vectors，普通 off/on-topic 判断使用 contextualized vectors，保留 buried-payload 防护并降低模型尺度差异。
- **信息流：** 保持 Daily Concept List → Derived List → Queue 的三层架构；“like”只增加 concept 在 derived list 中的 multiplicity，不创建第四个列表。
- **数据刷新：** 五个一级页面长期挂载，依赖可变 service state 的页面必须在 `[location.pathname]` 切回时重新读取。
- **低延迟生成：** 新增独立 `fastModel` 配置，仅用于 post body、news essay 和 post-context Q&A，并关闭/最小化 reasoning；Ask Q&A 继续使用主模型。
- **非强迫式产品约束：** Rewards 不允许 streak、排行榜、限时稀缺、loot box、功能性 power-up 或付费进度。

## 3. Phases Delivered

| Phase | Name | Status | One-liner |
|---|---|---|---|
| 54 | Code Quality, Bugs & Tech Debt | Complete | 完成全库 bug/债务审计，修复 Planner credit stale state、日期测试 flake，清理高优先级死代码并关闭历史 debug/todo。 |
| 55 | Algorithm & Mechanism Tuning | Complete | 落地 embedding cache、RAW-ARGMAX 过滤器、like boost、8-post refill 修复，并把重型存储切到 IndexedDB-primary。 |
| 55.1 | Device-Test Bug Fixes | Pending one device retest | 修复跨 session 串答、Gemini text-art 截断、键盘导航闪烁、首次 Send 失效、冷启动慢、空状态冲突，并加入 fast model；仅 Trellis 离屏性能修复待复测。 |
| 56 | UI Polish & Documentation | Planned | 已规划 18 屏 UI/动画/导航审计、operator triage、WebView-safe 修复和文档归档，尚未执行。 |
| 57 | Rewards Foundation | Not started | 计划先锁定 cosmetics 数据模型、原子购买、事件、Clear-All-Data 保留和非强迫式守卫。 |
| 58 | Rewards Core Shop Loop | Not started | 计划交付商店浏览、预览、购买、装备、主题和双入口。 |
| 59 | Rewards Pet & Garden Cosmetics | Not started | 计划交付 CSS/SVG 宠物、背景、花盆、藤蔓和果实外观。 |

## 4. Requirements Coverage

正式 `REQUIREMENTS.md` 当前记录：

- ✅ **8/26 complete：** QUALITY-01..03、TECHDEBT-13..14、TUNE-01..03。
- ⚠️ **BUGFIX-01..04 仍标记 Pending：** 实际原始四项已通过设备 UAT，但 Phase 55.1 尚未完成最终状态回填；BUGFIX-03 中“输入栏平滑跟随键盘”的扩展目标已接受为 WebView 限制。
- ⏳ **POLISH-01..03、DOCS-01..02：** Phase 56 已规划，未执行。
- ⏳ **REWARDS-01..09：** Phase 57–59 未开始。

Phase 55.1 后续扩展的 GAP-A..E 没有完整映射回 26 项正式 requirements，因此代码、ROADMAP、REQUIREMENTS 和 VERIFICATION 的状态存在轻微漂移。回归开发时应以 `55.1-HUMAN-UAT.md` 的 round-5 结论和当前源码为事实来源。

当前验证基线（2026-06-18 实测）：

- `npm test`：1594 main + 149 actions = **1743 pass，0 fail**。
- `npm run build`：通过。
- `npm run lint`：**0 errors，31 warnings**。

## 5. Key Decisions Log

- **D-v1.7-01：** Cleanup/hardening 分为质量、调优、UI/文档三段；Rewards 按数据层 → 核心商店 → 宠物/花园顺序建设。
- **D-v1.7-02：** Rewards 必须保持 cosmetic-only 和永久可用，不引入 FOMO 或功能性增益。
- **D-54：** 技术债使用 severity × reach 评分；高优先级修复，其余正式 re-accept。
- **D-55-Storage：** 由于浏览器开发环境已真实触发 localStorage quota，重型存储必须离开 localStorage；最终统一使用 IndexedDB，而不是维护 Web/Native 两套数据库。
- **D-55-Filter：** 从固定绝对阈值转向 RAW-ARGMAX + calibrated malicious floor，同时保留 raw/context 双向量结构。
- **D-55-Feed：** Like 复用现有 multiplicity lever；不改变三层 feed pipeline。
- **D-55.1-Fast：** 延迟敏感的 post-body 生成使用可选独立 fast model；Ask 与分类继续使用主模型。
- **D-55.1-Keyboard：** WebView 内无法低风险实现 WeChat 式 IME 平滑跟随；接受输入栏 teleport，不引入原生 bridge。
- **D-56：** UI 修复前必须先做只读审计并由 operator 逐项 triage；CLAUDE.md 漂移也必须确认后再改。

## 6. Tech Debt & Deferred Items

优先事项：

1. **完成 Phase 55.1：** 在 Android 设备上复测 commit `c08c30f2` 的离屏 plain-SVG Trellis 修复；通过后更新 HUMAN-UAT、VERIFICATION、REQUIREMENTS、STATE。
2. **执行 Phase 56：** 先跑 56-01 只读审计，再进行 operator triage；当前不能直接跳到视觉/导航修改。
3. **修正规划漂移：**
   - `STATE.md` 仍同时写 Phase 55.1 executing 和 “Phase 56 UI-SPEC approved”。
   - milestone phase count 没有一致计入插入的 Phase 55.1。
   - Phase 55 早期验证仍描述 WASM SQLite，最终实现已是 IndexedDB。
   - Phase 55.1 `VERIFICATION.md` 停在较早轮次，round-5 事实在 HUMAN-UAT 中。
4. **构建体积：** 当前主 bundle 约 1.46 MB（gzip 436 KB），背景图约 4.55 MB；Vite 仍报告 chunk-size 和 mixed static/dynamic import warnings。
5. **Lint：** 31 个 warnings，主要是 dev instrumentation 的 `console`、React hook dependencies 和未使用 eslint-disable。
6. **未提交工作区：** 当前存在本地日期语义修复、CJK regex 转义、相关测试调整，以及文档归档/新增文档；这些不属于本摘要提交，继续工作前应先确认并整理成独立 commit。

## 7. Getting Started

- **安装与运行：**
  - `cd app && npm install`
  - `npm run dev`
- **验证：**
  - `npm test`
  - `npm run build`
  - `npm run lint`
- **关键入口：**
  - `app/src/App.tsx`：路由、启动 hydration、Android back handler。
  - `app/src/services/db.service.ts`：IndexedDB backend。
  - `app/src/services/question-filter.service.ts`：RAW-ARGMAX 过滤器。
  - `app/src/services/concept-feed.service.ts` 与 `post-queue.service.ts`：信息流生成、derived list 与 queue。
  - `app/src/screens/AskScreen.tsx`：session-bound streaming。
  - `app/src/components/trellis/`：Planner Trellis 渲染与离屏性能修复。
- **建议恢复顺序：**
  1. 阅读 `55.1-HUMAN-UAT.md` 的 round-5。
  2. 检查并提交/放弃当前未提交改动。
  3. 完成 GAP-B 真机复测和 Phase 55.1 状态回填。
  4. 执行 Phase 56 的 56-01 审计与 56-02 triage。
  5. Phase 56 完成后再进入 Rewards 57–59。

---

## Stats

- **Timeline:** 2026-05-20 → 2026-05-22（核心提交集中在两天内；最后 UAT 记录跨到 5 月 22 日）
- **Phases:** 2 complete / 1 near-complete / 1 planned / 3 not started
- **Commits since v1.6:** 166
- **Files changed since v1.6:** 200（+23,425 / −3,051）
- **Contributor:** HuanfuLi
