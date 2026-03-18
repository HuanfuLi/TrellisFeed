Flow 1: 核心学习循环 (Ask & Link)
Flow name: 即时问答与知识图谱关联
Primary user goal: 快速获得一个问题的答案，并将其整合进现有的知识体系中。
Trigger: 用户产生了好奇心或疑问，打开应用。
Success condition: 用户获得满意的答案，并且该问题在知识图谱中显示出与其他知识点的关联。

User context:

Target user(s): 终身学习者、学生、知识工作者。

User state at entry: 好奇、急切需要答案，可能处于碎片时间（通勤、排队、工作间隙）。

Environment: 移动设备，可能网络不稳定，时间紧迫。

Assumptions and constraints:

Explicit assumptions: 用户已配置好 LLM API Key；本地数据库已初始化。

Technical constraints: LLM 响应有延迟；需支持流式输出；需要本地计算 Embedding 或调用 API。

Social / ethical constraints: 内容需符合 LLM 安全规范。

Out of scope behaviors: 复杂的富文本编辑、图片上传（当前版本仅限文本）。

MAIN PATH (happy path only)

 Step 1:

User action: 打开应用，点击底部的“问答”标签（默认页），在文本输入框输入问题 "什么是费曼技巧？"，点击发送。

System response: 界面立即清除输入框内容，在聊天流中显示用户问题。显示“正在思考...”或加载动画。系统后台同时检索相关历史问题摘要。

Screen or state name: 问答主页 (Chat View)

Information shown to user: 用户的问题气泡，加载指示器。

Feedback or confirmation: 键盘收起，输入框变灰或显示发送状态。

Step 2:

User action: 等待回答。

System response: 接收 LLM 流式数据，逐字渲染 Markdown 格式的回答。回答下方自动生成“关联知识提示”卡片（基于后台计算的图谱关联）。

Screen or state name: 问答主页 (Chat View - Streaming)

Information shown to user: 正在生成的文本，引用的关联知识点（如：“此前你问过：[艾宾浩斯曲线]”）。

Feedback or confirmation: 文本持续滚动，直到生成结束。

Step 3:

User action: 阅读回答，发现“关联知识提示”中有感兴趣的旧问题，点击关联卡片中的“[艾宾浩斯曲线]”。

System response: 跳转至“问题详情页”，展示旧问题的详细内容及关联上下文。

Screen or state name: 问题详情页 (Question Detail View)

Information shown to user: 旧问题的详细问答内容及所有关联点列表。

Feedback or confirmation: 视觉上确认了新旧知识的连接。

DECISION POINTS
 Decision point 1: 用户对回答不满意或需要追问

User choice(s): 在问答页继续输入追问 / 点击“重新生成”。

System behavior: 将上下文带入下一轮 LLM 调用 / 重新调用 API。

Next step: 回到 Step 2。

Decision point 2: 用户想查看某条关联知识的详细信息

User choice(s): 在问题详情页中点击关联项。

System behavior: 弹出底部抽屉 (Bottom Sheet)，显示该问题的完整问答记录。

Next step: 切换至该关联项的问题详情页。

SYSTEM STATES


Loading / processing: 问答页显示“正在构建知识连接...”Toast，表示后台正在更新图谱边。

Empty state: 首次使用时，问答页显示“问我任何问题，开始构建你的知识宇宙”。

Error state: API Key 无效或网络断开 -> 显示红色 Toast “连接失败，请检查设置或网络”，保留用户输入内容不丢失。

Confirmation / success state: 回答生成完毕，图谱更新完毕（通常无显式提示，通过 UI 变化反馈）。

EDGE CASES AND FAILURE MODES
 Edge case: 知识点无任何关联

What causes it: 输入了一个全新的、与之前领域完全无关的问题。

Current handling: 关联知识提示区域不显示或显示“探索新领域”。图谱中该节点暂时孤立。

Risk to user experience: 用户可能觉得不够智能。

ACCESSIBILITY AND ETHICS CHECK

Accessibility risks: 动态图谱对读屏软件支持可能不佳；需确保问答文字可缩放。

Privacy: 确保所有 Prompt 发送前已脱敏（如需），并在本地存储。

Flow 2: 时间区块与待办管理 (Block & Do)
Flow name: 日程规划与任务执行
Primary user goal: 规划一天的任务，并在特定时间块内专注完成，未完成的任务自动推迟。
Trigger: 早上开始工作前，或进入某个新的时间段。
Success condition: 任务被创建并归类到时间块，完成或被推迟处理。

User context:

Target user(s): 需要保持专注的学生或工作者。

User state: 可能感到杂乱、需要秩序感。

Environment: 办公桌前或移动中。

Assumptions and constraints:

Technical constraints: 需准确处理跨时区或时间计算逻辑。

MAIN PATH (happy path only)

 Step 1:

User action: 点击底部“日历”标签。

System response: 展示今日的时间轴，已划分好的时间区块（如 09:00-12:00 上午专注）。

Screen or state name: 日历主页 (Daily Schedule View)

Information shown to user: 垂直时间轴，区块卡片，每个卡片内的 Todo 列表。底部显示“今日待复习知识点”摘要。

Feedback or confirmation: 当前时间线指示器（Current Time Indicator）。

Step 2:

User action: 在“上午专注”区块内点击“+ 添加任务”，输入“阅读项目文档”。

System response: 列表即时插入新任务，状态为 Pending (空心圆圈)。

Screen or state name: 日历主页 (Edit State)

Information shown to user: 新增的任务项。

Feedback or confirmation: 输入框回车后自动聚焦下一行或收起。

Step 3:

User action: 时间到了下午，发现上午的任务没做完。点击任务旁的“推迟”图标（或右滑任务）。

System response: 原任务状态变为 Postponed (特殊图标)，并在下一个区块（或用户选择的区块）自动生成该任务副本。

Screen or state name: 日历主页 (Task Update)

Information shown to user: 上午区块任务变灰且有推迟标记，下午区块出现同名任务。

Feedback or confirmation: 简单的位移动画表示任务转移。

DECISION POINTS
 Decision point: 任务完成

User choice: 点击任务前的圆圈。

System behavior: 状态变为 Completed，显示删除线，文字变淡。

Next step: 留在当前页。

SYSTEM STATES


Empty state: 新的一天开始时，区块存在但 Todo 为空，显示“点击 + 规划此时段”。

Error state: 数据库写入失败 -> 任务暂时显示红色感叹号。

EDGE CASES AND FAILURE MODES
 Edge case: 最后一个区块推迟任务

What causes it: 用户在当晚最后一个时间块点击推迟。

Current handling: 系统应询问“推迟到明天第一个区块？”或自动创建明天的草稿。

Risk to user experience: 任务可能“消失”在视野外。

Flow 3: 每日回顾与播客 (Review & Listen)
Flow name: 睡前知识巩固与播客生成
Primary user goal: 在睡前通过听觉回顾一天的知识，并完成间隔重复复习。
Trigger: 设定的睡前时间前 1 小时，收到系统通知“今日总结播客已就绪”。
Success condition: 用户听完播客，并完成今日的 Flashcard 复习。

User context:

Target user(s): 习惯睡前复习的用户。

User state: 疲惫，不想看屏幕，适合听觉输入。

Environment: 卧室，安静环境，可能已戴上耳机。

Assumptions and constraints:

Technical constraints: 本地 TTS 生成耗时较长（需提前触发）；ZeroTier 需保持连接（如果用本地 TTS）。

Social / ethical constraints: 声音不能过于机械，需要情感化（依赖 Prompt 和 TTS 模型）。

MAIN PATH (happy path only)

 Step 1:

User action: 点击通知或手动打开“播客”页面。

System response: 显示今日播客卡片，状态为 Ready，显示时长“08:45”。

Screen or state name: 播客播放器 (Player View)

Information shown to user: 播放按钮，进度条，今日涵盖的知识点关键词列表。

Feedback or confirmation: 播放按钮处于可点击状态。

Step 2:

User action: 点击播放。

System response: 开始播放音频。音频内容是 AI 生成的两个“主持人”对话，讨论用户今天问过的“费曼技巧”。

Screen or state name: 播客播放器 (Playing State)

Information shown to user: 波形跳动，进度条走动。

Feedback or confirmation: 声音输出。

Step 3:

User action: 听完播客后，系统弹出提示“巩固一下？进行今日复习”。用户点击“开始复习”。

System response: 跳转至“复习”页面（Flashcard 模式）。

Screen or state name: 复习页 (Review Mode)

Information shown to user: 显示问题卡片正面“什么是 SM-2 算法？”。

Feedback or confirmation: 只有“显示答案”按钮可见。

Step 4:

User action: 思考后点击“显示答案”。

System response: 卡片翻转或展开，显示答案。底部出现评分栏 (1-5分)。

Screen or state name: 复习页 (Answer Revealed)

Information shown to user: 完整答案，评分按钮。

Feedback or confirmation: 必须评分才能进入下一题。

DECISION POINTS
 Decision point: 播客生成失败

User choice: 点击“重试”。

System behavior: 重新触发生成流程，显示进度条。

Next step: 等待生成（Flow 暂时阻断）。

SYSTEM STATES


Loading / processing: 播客状态显示 "Generating..."，进度条显示脚本生成或音频合成进度。

Confirmation / success state: 复习完成，显示“今日复习已清空”及鼓励语。

EDGE CASES AND FAILURE MODES
 Edge case: ZeroTier 连接断开导致本地 TTS 不可用

What causes it: 手机切换网络或家用电脑休眠。

Current handling: 播客生成失败，提示“无法连接本地 TTS 服务，请检查 ZeroTier 或切换至 OpenAI TTS”。

Risk to user experience: 核心功能不可用，挫败感强。

ACCESSIBILITY AND ETHICS CHECK

Accessibility: 播客播放器需提供倍速播放；复习卡片需支持大字体。

Data: 确保生成的播客音频文件存储在本地，不上传至公共云端（除非用户备份）。