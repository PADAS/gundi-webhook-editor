// Help drawer - Reference, Examples, and AI Assistant
(function () {
    let drawerEl = null;
    let initialized = false;
    let activeTab = 'reference';
    let chatHistory = [];
    let focusedSampleJson = null;

    window.initHelpDrawer = function () {
        // Lazy init - DOM created on first toggle
    };

    window.toggleHelpDrawer = function () {
        if (!drawerEl) {
            createDrawer();
            initialized = true;
        }
        drawerEl.classList.toggle('open');
        document.getElementById('helpToggle').classList.toggle('active');
    };

    function createDrawer() {
        drawerEl = document.getElementById('helpDrawer');
        drawerEl.innerHTML = `
            <div class="help-drawer-header">
                <div class="help-tabs">
                    <button class="help-tab active" data-tab="reference">Reference</button>
                    <button class="help-tab" data-tab="examples">Examples</button>
                    <button class="help-tab" data-tab="assistant">Assistant</button>
                </div>
                <button class="help-close" title="Close">&times;</button>
            </div>
            <div class="help-tab-content" id="helpTabContent">
                <div class="help-pane active" data-pane="reference"></div>
                <div class="help-pane" data-pane="examples"></div>
                <div class="help-pane" data-pane="assistant"></div>
            </div>
        `;

        // Tab switching
        drawerEl.querySelectorAll('.help-tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        drawerEl.querySelector('.help-close').addEventListener('click', toggleHelpDrawer);

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (drawerEl.classList.contains('open') &&
                !drawerEl.contains(e.target) &&
                !e.target.closest('#helpToggle')) {
                toggleHelpDrawer();
            }
        });

        renderReferenceTab();
        renderExamplesTab();
        renderAssistantTab();
    }

    function switchTab(tabName) {
        activeTab = tabName;
        drawerEl.querySelectorAll('.help-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabName);
        });
        drawerEl.querySelectorAll('.help-pane').forEach(p => {
            p.classList.toggle('active', p.dataset.pane === tabName);
        });
    }

    // ---- Reference Tab ----

    function renderReferenceTab() {
        const pane = drawerEl.querySelector('[data-pane="reference"]');
        pane.innerHTML = `
            <div class="help-search-wrapper">
                <input type="text" class="help-search" placeholder="Search jq functions..." id="refSearch">
            </div>
            <div class="help-ref-list" id="refList"></div>
        `;

        const searchInput = pane.querySelector('#refSearch');
        searchInput.addEventListener('input', () => filterReference(searchInput.value));
        renderReferenceList('');
    }

    function filterReference(query) {
        renderReferenceList(query.toLowerCase());
    }

    function renderReferenceList(query) {
        const list = drawerEl.querySelector('#refList');
        let html = '';

        window.JQ_REFERENCE.forEach(cat => {
            const filtered = cat.items.filter(item =>
                !query ||
                item.name.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query) ||
                item.example.toLowerCase().includes(query)
            );
            if (filtered.length === 0) return;

            html += `<div class="ref-category">
                <div class="ref-category-header">${escapeHtml(cat.category)}</div>
                ${filtered.map(item => `
                    <div class="ref-item" data-insert="${escapeAttr(item.name)}">
                        <div class="ref-item-header">
                            <code class="ref-name">${escapeHtml(item.name)}</code>
                        </div>
                        <div class="ref-desc">${escapeHtml(item.description)}</div>
                        <code class="ref-example">${escapeHtml(item.example)}</code>
                    </div>
                `).join('')}
            </div>`;
        });

        if (!html) {
            html = '<div class="help-empty">No matching functions found</div>';
        }

        list.innerHTML = html;

        // Click to insert into editor
        list.querySelectorAll('.ref-item').forEach(el => {
            el.addEventListener('click', () => {
                const name = el.dataset.insert;
                if (typeof filterEditor !== 'undefined') {
                    const editor = filterEditor;
                    const pos = editor.getPosition();
                    editor.executeEdits('help-insert', [{
                        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                        text: name
                    }]);
                    editor.focus();
                }
            });
        });
    }

    // ---- Examples Tab ----

    function renderExamplesTab() {
        const pane = drawerEl.querySelector('[data-pane="examples"]');
        let html = '';

        window.JQ_EXAMPLES.forEach(cat => {
            html += `<div class="ex-category">
                <div class="ex-category-header">${escapeHtml(cat.category)}</div>
                ${cat.examples.map(ex => `
                    <div class="ex-card">
                        <div class="ex-title">${escapeHtml(ex.title)}</div>
                        <div class="ex-desc">${escapeHtml(ex.description)}</div>
                        <code class="ex-expression">${escapeHtml(ex.expression)}</code>
                        <button class="btn ghost ex-try-btn" data-expr="${escapeAttr(ex.expression)}" data-input="${escapeAttr(ex.input)}">Try it</button>
                    </div>
                `).join('')}
            </div>`;
        });

        pane.innerHTML = html;

        // "Try it" buttons
        pane.querySelectorAll('.ex-try-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const expr = btn.dataset.expr;
                const input = btn.dataset.input;
                if (typeof filterEditor !== 'undefined') {
                    filterEditor.setValue(expr);
                    filterEditor.focus();
                }
                // If there are no samples and there's a current filter, add a temporary sample
                // by showing it in a toast
                if (input) {
                    showToast('Example loaded. Add sample JSON to test: ' + input.substring(0, 60) + (input.length > 60 ? '...' : ''), 'info', 5000);
                }
            });
        });
    }

    // ---- Assistant Tab ----

    function renderAssistantTab() {
        const pane = drawerEl.querySelector('[data-pane="assistant"]');
        pane.innerHTML = `
            <div class="chat-messages" id="chatMessages">
                <div class="chat-welcome">
                    <div class="chat-welcome-title">jq Assistant</div>
                    <div class="chat-welcome-desc">Ask questions about jq filters, get help writing expressions, or debug errors.</div>
                </div>
            </div>
            <div class="chat-input-area">
                <textarea id="chatInput" class="chat-textarea" placeholder="Ask about jq..." rows="2"></textarea>
                <button id="chatSendBtn" class="btn primary chat-send">Send</button>
            </div>
        `;

        const sendBtn = pane.querySelector('#chatSendBtn');
        const chatInput = pane.querySelector('#chatInput');

        sendBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    async function sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        if (!message) return;

        input.value = '';
        appendChatMessage('user', message);

        // Gather context
        const filterExpression = typeof filterEditor !== 'undefined' ? filterEditor.getValue() : '';
        const sampleForContext = focusedSampleJson || (typeof samples !== 'undefined' && samples.length > 0 ? samples[0].payload : '');

        // Show loading
        const loadingId = appendChatMessage('assistant', '<span class="chat-loading">Thinking...</span>');

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (typeof authToken !== 'undefined' && authToken) {
                headers['Authorization'] = 'Bearer ' + authToken;
            }

            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message,
                    filter_expression: filterExpression || undefined,
                    sample_json: sampleForContext || undefined,
                    history: chatHistory.slice(-10)
                })
            });

            const data = await response.json();
            removeChatMessage(loadingId);

            if (data.error) {
                appendChatMessage('assistant', '<span class="chat-error">Error: ' + escapeHtml(data.error) + '</span>');
            } else {
                chatHistory.push({ role: 'user', content: message });
                chatHistory.push({ role: 'assistant', content: data.response });
                appendChatMessage('assistant', renderMarkdown(data.response));
            }
        } catch (err) {
            removeChatMessage(loadingId);
            appendChatMessage('assistant', '<span class="chat-error">Failed to reach AI assistant. Check Vertex AI configuration.</span>');
        }
    }

    let msgCounter = 0;

    function appendChatMessage(role, html) {
        const messages = document.getElementById('chatMessages');
        const id = 'msg-' + (++msgCounter);
        const div = document.createElement('div');
        div.className = 'chat-msg ' + role;
        div.id = id;
        div.innerHTML = `<div class="chat-bubble">${html}</div>`;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;

        // Attach "Use this filter" buttons
        div.querySelectorAll('.chat-use-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.dataset.code;
                if (typeof filterEditor !== 'undefined') {
                    filterEditor.setValue(code);
                    filterEditor.focus();
                    showToast('Filter applied from assistant', 'success');
                }
            });
        });

        return id;
    }

    function removeChatMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function renderMarkdown(text) {
        // Basic markdown rendering
        let html = escapeHtml(text);

        // Code blocks with jq language - add "Use this filter" button
        html = html.replace(/```jq\n([\s\S]*?)```/g, (_, code) => {
            const trimmed = code.trim();
            return `<pre class="chat-code"><code>${trimmed}</code></pre><button class="btn ghost chat-use-filter" data-code="${escapeAttr(trimmed)}">Use this filter</button>`;
        });

        // Generic code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre class="chat-code"><code>${code.trim()}</code></pre>`;
        });

        // Remaining ``` blocks without language
        html = html.replace(/```\n?([\s\S]*?)```/g, (_, code) => {
            return `<pre class="chat-code"><code>${code.trim()}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');

        // Bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    // ---- "Ask AI about this sample" helper ----
    window.askAIAboutSample = function (payload) {
        if (!drawerEl || !drawerEl.classList.contains('open')) {
            toggleHelpDrawer();
        }
        switchTab('assistant');
        focusedSampleJson = payload;

        // Proactively send analysis request
        const input = document.getElementById('chatInput');
        if (input) {
            input.value = 'Analyze this JSON payload and suggest useful jq filters to extract its key fields.';
            sendChatMessage();
        }
    };

    // ---- "Ask AI about this error" helper ----
    window.askAIAboutError = function (errorMsg) {
        if (!drawerEl || !drawerEl.classList.contains('open')) {
            toggleHelpDrawer();
        }
        switchTab('assistant');
        const input = document.getElementById('chatInput');
        if (input) {
            input.value = 'I got this error: ' + errorMsg + '\nHow do I fix it?';
            input.focus();
        }
    };

    // ---- Utilities ----

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeAttr(text) {
        return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
})();
