// @ts-nocheck -- served directly as dependency-free browser JavaScript.
const root = document.querySelector('#app');
const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
history.replaceState(null, '', location.pathname);

const state = { session: null, queue: [], visible: [], index: 0, search: '', filter: 'all', busy: false };
const decisionLabels = { approved: '已批准', 'needs-edit': '需要修改', rejected: '已拒绝' };
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function append(parent, ...children) { children.filter(Boolean).forEach((child) => parent.append(child)); return parent; }
function badge(text, className = '') { return el('span', text, `badge ${className}`.trim()); }
function button(text, className = 'button') { const node = el('button', text, className); node.type = 'button'; return node; }
function input(value = '', type = 'text') { const node = el('input'); node.type = type; node.value = value ?? ''; return node; }
function select(options, value = '') {
  const node = el('select');
  for (const [key, label] of options) { const option = el('option', label); option.value = key; option.selected = key === value; node.append(option); }
  return node;
}
function section(title, eyebrow) { const node = el('section', undefined, 'section'); const head = el('div', undefined, 'section-head'); append(head, el('h3', title), eyebrow ? el('span', eyebrow, 'eyebrow') : null); node.append(head); return node; }
function infoCard(title, body, tags = []) { const node = el('div', undefined, 'info-card'); append(node, el('h4', title), el('p', body)); if (tags.length) { const row = el('div', undefined, 'tags'); tags.forEach((tag) => row.append(el('span', tag, 'tag'))); node.append(row); } return node; }
function safeArray(value) { return Array.isArray(value) ? value : []; }
function percent(value) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number * 100))) : 0; }

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'x-review-token': token, ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function applyFilters() {
  const query = state.search.trim().toLocaleLowerCase();
  state.visible = state.queue.filter((candidate) => {
    const decided = Boolean(candidate.latestDecision);
    const matchesFilter = state.filter === 'all' || (state.filter === 'pending' && !decided) || (state.filter === 'decided' && decided)
      || (state.filter === 'video' && candidate.source.kind === 'video') || (state.filter === 'text' && candidate.source.kind !== 'video');
    const haystack = `${candidate.id} ${candidate.draft.displayTitle || ''} ${candidate.source.title || ''} ${candidate.source.author || ''} ${candidate.source.sourceName || ''}`.toLocaleLowerCase();
    return matchesFilter && (!query || haystack.includes(query));
  });
  state.index = Math.max(0, Math.min(state.index, state.visible.length - 1));
}

function renderTopbar() {
  const decided = state.queue.filter((candidate) => candidate.latestDecision).length;
  const header = el('header', undefined, 'topbar');
  const brand = el('div', undefined, 'brand');
  append(brand, el('h1', 'QuestionTrace 内容审核'), el('p', '最终决定由你记录；Codex 仅提供审查意见'));
  const stats = el('div', undefined, 'top-stats');
  const progress = el('div', undefined, 'progress'); const fill = el('span'); fill.style.width = `${state.queue.length ? (decided / state.queue.length) * 100 : 0}%`; progress.append(fill);
  const remainingMinutes = Math.max(0, Math.ceil((state.session.expiresAt - Date.now()) / 60000));
  append(stats, el('strong', `${decided}/${state.queue.length} 已决定`), progress, el('span', `会话剩余约 ${remainingMinutes} 分钟`));
  append(header, brand, stats); return header;
}

function renderSidebar() {
  const aside = el('aside', undefined, 'sidebar');
  const tools = el('div', undefined, 'sidebar-tools');
  const search = input(state.search); search.placeholder = '搜索标题、作者、ID';
  search.addEventListener('input', () => { state.search = search.value; applyFilters(); render(); });
  const filter = select([['all','全部内容'],['pending','仅待审核'],['decided','仅已决定'],['video','仅视频'],['text','仅文本']], state.filter);
  filter.addEventListener('change', () => { state.filter = filter.value; state.index = 0; applyFilters(); render(); });
  append(tools, search, filter); aside.append(tools);
  const list = el('ol', undefined, 'queue');
  state.visible.forEach((candidate, index) => {
    const item = el('li'); const node = button('', index === state.index ? 'active' : '');
    append(node, el('span', String(index + 1).padStart(2, '0'), 'queue-index'));
    const title = el('span', candidate.draft.displayTitle || candidate.source.title, 'queue-title'); node.append(title);
    const meta = el('span', undefined, 'queue-meta');
    append(meta, el('span', candidate.source.kind === 'video' ? '视频' : '文本'), el('span', candidate.latestDecision ? decisionLabels[candidate.latestDecision.disposition] : '待审核'));
    node.append(meta); node.addEventListener('click', () => { state.index = index; render(); document.querySelector('.main')?.scrollTo(0, 0); window.scrollTo(0, 0); });
    item.append(node); list.append(item);
  });
  aside.append(list); return aside;
}

function renderSource(candidate) {
  const node = section('来源与归属', candidate.source.kind === 'video' ? '播放原视频核验' : '已冻结完整原文');
  const grid = el('dl', undefined, 'source-grid');
  const values = [['平台/来源', candidate.source.sourceName || '未知'], ['作者', candidate.source.author || '未提供'], ['发布日期', candidate.source.publicationDate || '未提供'], ['候选 ID', candidate.id]];
  values.forEach(([name, value]) => { const item = el('div', undefined, 'meta-item'); append(item, el('dt', name), el('dd', value)); grid.append(item); });
  node.append(grid);
  const link = el('a', candidate.source.kind === 'video' ? '在新窗口播放原视频 ↗' : '打开原始来源 ↗', 'source-link');
  link.href = candidate.source.canonicalUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; node.append(link);
  return node;
}

function renderSummary(candidate) {
  const draft = candidate.draft; const node = section('用户会看到什么', '核心包装');
  append(node, el('p', draft.hook, 'lede'), el('p', draft.shortSummary, 'summary-long'), el('p', draft.longSummary, 'summary-long'));
  const scores = el('div', undefined, 'score-grid'); scores.style.marginTop = '22px';
  [['质量',draft.qualityScore],['趣味性',draft.interestingnessScore],['教育价值',draft.educationalValueScore],['难度',draft.difficulty],['主题相关',draft.topicRelevance]].forEach(([name,value]) => {
    const row = el('div', undefined, 'score'); const track = el('div', undefined, 'score-track'); const fill = el('span'); fill.style.width = `${percent(value)}%`; track.append(fill);
    append(row, el('span', name), track, el('strong', Number(value).toFixed(2))); scores.append(row);
  });
  node.append(scores); return node;
}

function renderClaims(candidate) {
  const node = section('中心主张', `${safeArray(candidate.draft.claims).length} 条`); const cards = el('div', undefined, 'cards');
  safeArray(candidate.draft.claims).forEach((claim, index) => cards.append(infoCard(`主张 ${index + 1} · ${claim.stance}`, claim.text, [...safeArray(claim.conceptLabels), ...safeArray(claim.sourceBlockIds)])));
  node.append(cards); return node;
}

function renderConceptsAndQuestions(candidate) {
  const node = section('概念与建议问题', '图谱与互动'); const cards = el('div', undefined, 'cards');
  safeArray(candidate.draft.concepts).forEach((concept) => cards.append(infoCard(concept.label, concept.description, safeArray(concept.aliases))));
  node.append(cards); const heading = el('h3', '建议问题'); heading.style.margin = '24px 0 12px'; node.append(heading);
  const list = el('ol', undefined, 'numbered'); safeArray(candidate.draft.suggestedQuestions).forEach((question) => { const item = el('li'); append(item, el('strong', question.text), el('div', `${question.type} · ${safeArray(question.targetConceptLabels).join('、')}`, 'muted')); list.append(item); }); node.append(list);
  return node;
}

function renderConcerns(candidate) {
  const node = section('风险、反方与警告', '重点检查');
  const groups = [['可靠性',candidate.draft.reliabilityConcerns],['潜在反方',candidate.draft.potentialCounterpoints],['安全问题',candidate.draft.safetyConcerns],['内容警告',candidate.draft.contentWarnings]];
  let count = 0; groups.forEach(([label, values]) => safeArray(values).forEach((value) => { count += 1; node.append(infoCard(label, value)); }));
  if (!count) node.append(el('p', '没有记录到额外风险或内容警告。', 'empty')); return node;
}

function renderCodex(candidate) {
  const node = section('Codex 独立审查', candidate.codexCurrent ? '当前版本已通过' : '需要重新审查'); node.classList.add('codex');
  const advisory = candidate.codex?.advisory;
  if (!advisory) { node.append(el('p', candidate.codex?.reasonCode || '没有可用意见', 'alert')); return node; }
  append(node, el('p', advisory.fidelityNotes), el('p', advisory.reliabilityNotes, 'muted'));
  const tags = el('div', undefined, 'tags'); safeArray(advisory.reasonCodes).forEach((reason) => tags.append(el('span', reason, 'tag'))); node.append(tags); return node;
}

function renderEvidence(candidate) {
  const node = section(candidate.source.kind === 'video' ? '视频核验说明' : '完整原文', '按需展开');
  if (candidate.source.kind === 'video') {
    append(node, el('p', '系统没有保存字幕、音频或视频。请通过上方固定 URL 播放原视频，并对照摘要与中心主张。', 'alert'));
  } else {
    const details = el('details'); append(details, el('summary', `展开完整原文（${candidate.source.fullText.length.toLocaleString()} 字符）`), el('pre', candidate.source.fullText)); node.append(details);
  }
  return node;
}

function renderDecision(candidate) {
  const node = section('记录最终决定', '三选一'); node.classList.add('decision');
  const notes = el('textarea'); notes.placeholder = '审核备注（可选）'; notes.className = 'review-notes';
  if (candidate.latestDecision?.notes) notes.value = candidate.latestDecision.notes;
  node.append(notes);
  const status = el('p', candidate.latestDecision ? `最近决定：${decisionLabels[candidate.latestDecision.disposition]} · ${new Date(candidate.latestDecision.decidedAt).toLocaleString()}` : '尚未记正式决定。', 'status'); node.append(status);

  async function submit(disposition) {
    if (state.busy) return; state.busy = true; renderActionsDisabled(true);
    const payload = { disposition, notes: notes.value.trim(), editedContentHash: candidate.contentHash };
    try {
      await api(`/api/candidates/${encodeURIComponent(candidate.id)}/decision`, { method: 'POST', headers: { origin: location.origin, 'x-csrf-token': state.session.csrfToken, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      status.textContent = `已记录：${disposition}`; status.className = 'status success';
      state.queue = await api('/api/queue'); applyFilters();
      if (state.filter === 'pending') state.index = Math.min(state.index, Math.max(0, state.visible.length - 1)); else state.index = Math.min(state.index + 1, Math.max(0, state.visible.length - 1));
      render();
    } catch (error) { status.textContent = error.message; status.className = 'status error'; }
    finally { state.busy = false; renderActionsDisabled(false); }
  }

  const actions = el('div', undefined, 'form-actions');
  const approve = button('批准并进入下一条', 'button primary'); approve.addEventListener('click', () => submit('approved'));
  const needsEdit = button('标记为需要修改', 'button warn'); needsEdit.addEventListener('click', () => submit('needs-edit'));
  const reject = button('拒绝', 'button danger'); reject.addEventListener('click', () => submit('rejected'));
  append(actions, approve, needsEdit, reject); node.append(actions);
  function renderActionsDisabled(disabled) { [approve, needsEdit, reject].forEach((control) => { control.disabled = disabled; }); }
  return node;
}

function renderCandidate() {
  const main = el('main', undefined, 'main'); const page = el('div', undefined, 'review-page');
  if (!state.visible.length) { page.append(el('p', '当前筛选条件下没有候选内容。', 'empty')); main.append(page); return main; }
  const candidate = state.visible[state.index]; const head = el('div', undefined, 'candidate-head'); const badges = el('div', undefined, 'badges');
  append(badges, badge(candidate.source.kind === 'video' ? '视频' : '文本', candidate.source.kind === 'video' ? 'video' : ''), badge(candidate.codexCurrent ? 'Codex 已通过' : 'Codex 非当前', candidate.codexCurrent ? 'good' : ''), candidate.latestDecision ? badge(decisionLabels[candidate.latestDecision.disposition], 'decided') : badge('待审核'));
  append(head, badges, el('h2', candidate.draft.displayTitle || candidate.source.title), el('p', `${candidate.source.author || candidate.source.sourceName || '未知作者'} · ${candidate.source.publicationDate || '无日期'} · ${state.index + 1}/${state.visible.length}`));
  append(page, head, renderSource(candidate), renderSummary(candidate), renderClaims(candidate), renderConceptsAndQuestions(candidate), renderConcerns(candidate), renderCodex(candidate), renderEvidence(candidate), renderDecision(candidate));
  const nav = el('div', undefined, 'nav-row'); const previous = button('← 上一条'); previous.disabled = state.index === 0; previous.addEventListener('click', () => { state.index -= 1; render(); window.scrollTo(0,0); }); const next = button('下一条 →'); next.disabled = state.index >= state.visible.length - 1; next.addEventListener('click', () => { state.index += 1; render(); window.scrollTo(0,0); }); append(nav, previous, next); page.append(nav);
  main.append(page); return main;
}

function render() {
  root.className = ''; root.replaceChildren();
  append(root, renderTopbar()); const workspace = el('div', undefined, 'workspace'); append(workspace, renderSidebar(), renderCandidate()); root.append(workspace);
}

async function start() {
  try { state.session = await api('/api/session'); state.queue = await api('/api/queue'); applyFilters(); render(); }
  catch (error) { root.className = 'loading-shell'; root.replaceChildren(el('p', error.message === 'session expired' ? '审核会话已过期，请重新启动本地审核服务。' : error.message, 'error')); }
}
start();
