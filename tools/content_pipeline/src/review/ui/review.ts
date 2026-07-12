// @ts-nocheck -- served directly as dependency-free browser JavaScript.
const root = document.querySelector('#app');
const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
history.replaceState(null, '', location.pathname);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

function show(label, value) {
  const section = element('section');
  section.append(element('h3', label), element('pre', typeof value === 'string' ? value : JSON.stringify(value, null, 2)));
  return section;
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'x-review-token': token, ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function render() {
  try {
    const session = await api('/api/session');
    const queue = await api('/api/queue');
    root.append(element('p', `${queue.length} candidate(s). Session expires ${new Date(session.expiresAt).toLocaleTimeString()}.`));
    for (const candidate of queue) {
      const article = element('article');
      article.append(element('h2', candidate.draft.displayTitle || candidate.source.title));
      article.append(show('Source attribution and link', { sourceName: candidate.source.sourceName, author: candidate.source.author, sourceUrl: candidate.source.canonicalUrl, publicationDate: candidate.source.publicationDate, collectorVersion: candidate.source.collectorVersion }));
      article.append(show('Hook', candidate.draft.hook), show('Summaries', { short: candidate.draft.shortSummary, long: candidate.draft.longSummary }));
      article.append(show('Concepts and claims', { concepts: candidate.draft.concepts, claims: candidate.draft.claims }));
      article.append(show('Stance, difficulty, and scores', { viewpoint: candidate.draft.viewpoint, difficulty: candidate.draft.difficulty, quality: candidate.draft.qualityScore, interestingness: candidate.draft.interestingnessScore, educationalValue: candidate.draft.educationalValueScore, topicRelevance: candidate.draft.topicRelevance }));
      article.append(show('Suggested questions and targets', candidate.draft.suggestedQuestions));
      article.append(show('Reliability, bias, misinformation, safety, and warnings', { reliabilityConcerns: candidate.draft.reliabilityConcerns, counterpoints: candidate.draft.potentialCounterpoints, safetyConcerns: candidate.draft.safetyConcerns, contentWarnings: candidate.draft.contentWarnings }));
      article.append(show(candidate.source.kind === 'video' ? 'Fixed video URL / ID and derived digest' : 'Full stored article text', candidate.source.kind === 'video' ? { sourceUrl: candidate.source.canonicalUrl, videoId: candidate.source.videoId, digest: candidate.draft.longSummary, claims: candidate.draft.claims } : candidate.source.fullText), show('Current Codex advisory verdict', { current: candidate.codexCurrent, result: candidate.codex }));
      article.append(show('Required operator rubric', candidate.reviewTemplate), show('Latest operator decision', candidate.latestDecision || 'None'));
      const textarea = element('textarea'); textarea.placeholder = 'Paste complete edited draft JSON to create a new revision';
      const edit = element('button', 'Save edit (invalidates Codex verdict)');
      edit.addEventListener('click', async () => { try { await api(`/api/candidates/${encodeURIComponent(candidate.id)}/edit`, { method: 'POST', headers: { origin: location.origin, 'x-csrf-token': session.csrfToken, 'content-type': 'application/json' }, body: JSON.stringify({ draft: JSON.parse(textarea.value), editor: prompt('Editor name') || '', notes: prompt('Edit notes') || '' }) }); location.reload(); } catch (error) { alert(error.message); } });
      const controls = element('div', undefined, 'controls'); controls.append(textarea, edit);
      for (const disposition of ['approved', 'rejected', 'needs-edit']) {
        const button = element('button', disposition);
        button.addEventListener('click', async () => {
          const payloadText = prompt('Paste completed ReviewDecision JSON (review dimensions, rights review, scores, tags, reviewer, notes, rubricVersion)');
          if (!payloadText) return;
          try { const payload = JSON.parse(payloadText); payload.disposition = disposition; payload.editedContentHash = candidate.contentHash; await api(`/api/candidates/${encodeURIComponent(candidate.id)}/decision`, { method: 'POST', headers: { origin: location.origin, 'x-csrf-token': session.csrfToken, 'content-type': 'application/json' }, body: JSON.stringify(payload) }); location.reload(); } catch (error) { alert(error.message); }
        });
        controls.append(button);
      }
      article.append(controls); root.append(article);
    }
  } catch (error) { root.append(element('p', error.message, 'error')); }
}
render();
