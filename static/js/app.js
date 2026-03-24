// Monaco Editor configuration
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' } });

let filterEditor;
let currentFilter = null;
let samples = []; // { id, payload, label, result, error }
let expandedSampleIds = new Set();
let pollInterval = null;
let authToken = null;
let authDisabled = false;
let currentUser = null;
let devUser = null;
let editingSampleId = null;

// ---- Theme ----

function getTheme() {
    return localStorage.getItem('theme') || 'dark';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '\u263E' : '\u2600';
    // Update Monaco theme if loaded
    if (typeof monaco !== 'undefined') {
        monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
    }
}

function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
}

// Apply saved theme immediately (before Monaco loads)
applyTheme(getTheme());

const monacoTheme = getTheme() === 'dark' ? 'vs-dark' : 'vs';

const editorOptions = {
    minimap: { enabled: false },
    automaticLayout: true,
    theme: monacoTheme,
    fontSize: 13,
    lineHeight: 20,
    padding: { top: 12 },
    scrollBeyondLastLine: false,
    renderLineHighlight: 'none',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
};

require(['vs/editor/editor.main'], function () {
    if (typeof registerJqLanguage === 'function') {
        registerJqLanguage();
    }

    filterEditor = monaco.editor.create(document.getElementById('filterEditor'), {
        value: '.',
        language: 'jq',
        ...editorOptions
    });

    setupEventListeners();
    initAuth();
    if (typeof initHelpDrawer === 'function') {
        initHelpDrawer();
    }

    window.addEventListener('resize', () => {
        filterEditor.layout();
    });
});

// ---- Auth ----

async function initAuth() {
    try {
        const resp = await fetch('/api/config');
        const config = await resp.json();
        authDisabled = config.authDisabled;

        if (authDisabled) {
            document.getElementById('loginBtn').style.display = 'none';
            document.getElementById('logoutBtn').style.display = 'none';
            initDevUserSwitcher();
            return;
        }

        firebase.initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
        });

        if (config.authEmulatorUrl) {
            firebase.auth().useEmulator(config.authEmulatorUrl);
        }

        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                authToken = await user.getIdToken();
                document.getElementById('loginBtn').style.display = 'none';
                document.getElementById('logoutBtn').style.display = 'inline-flex';
                document.getElementById('userEmail').style.display = 'inline';
                document.getElementById('userEmail').textContent = user.email;
                loadSavedFilters();
            } else {
                currentUser = null;
                authToken = null;
                document.getElementById('loginBtn').style.display = 'inline-flex';
                document.getElementById('logoutBtn').style.display = 'none';
                document.getElementById('userEmail').style.display = 'none';
            }
        });

        // Refresh token every 10 minutes
        setInterval(async () => {
            const user = firebase.auth().currentUser;
            if (user) {
                authToken = await user.getIdToken(true);
            }
        }, 10 * 60 * 1000);

        document.getElementById('loginBtn').addEventListener('click', () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            firebase.auth().signInWithPopup(provider);
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            firebase.auth().signOut();
            authToken = null;
            currentFilter = null;
            samples = [];
            renderSamples();
            document.getElementById('filtersList').innerHTML = '';
            updateEmptyState(0);
        });
    } catch (error) {
        console.error('Auth init error:', error);
        // Fallback: assume auth disabled
        authDisabled = true;
        loadSavedFilters();
    }
}

function initDevUserSwitcher() {
    const saved = localStorage.getItem('devUser') || 'user-a@dev.local';
    devUser = saved;

    const switcher = document.getElementById('devUserSwitcher');
    const select = document.getElementById('devUserSelect');
    switcher.style.display = 'flex';
    select.value = devUser;

    select.addEventListener('change', () => switchDevUser(select.value));

    loadSavedFilters();
}

function switchDevUser(email) {
    localStorage.setItem('devUser', email);
    devUser = email;

    stopSamplePolling();
    currentFilter = null;
    samples = [];
    expandedSampleIds.clear();
    renderSamples();
    updateDeleteButton();
    updateWebhookUrl();
    updateOwnershipUI();
    loadSavedFilters();
}

async function apiFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (authDisabled && devUser) {
        headers['X-Dev-User'] = devUser;
    }
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 && !authDisabled) {
        showToast('Session expired. Please sign in again.', 'error');
        firebase.auth().signOut();
        throw new Error('Unauthorized');
    }
    return response;
}

function setupEventListeners() {
    document.getElementById('testBtn').addEventListener('click', testAllSamples);
    document.getElementById('saveBtn').addEventListener('click', saveFilter);
    document.getElementById('newFilterBtn').addEventListener('click', newFilter);
    document.getElementById('deleteBtn').addEventListener('click', deleteFilter);
    document.getElementById('addSampleBtn').addEventListener('click', openAddSampleModal);
    document.getElementById('clearSamplesBtn').addEventListener('click', clearAllSamples);
    document.getElementById('cancelSampleBtn').addEventListener('click', closeAddSampleModal);
    document.getElementById('saveSampleBtn').addEventListener('click', addSample);
    document.getElementById('copyWebhookBtn').addEventListener('click', copyWebhookUrl);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('shareBtn').addEventListener('click', shareEmail);
    document.getElementById('filterEnabled').addEventListener('click', () => {
        const cur = document.getElementById('filterEnabled').dataset.enabled === 'true';
        setEnabledToggle(!cur);
    });
    document.querySelector('.modal-backdrop').addEventListener('click', closeAddSampleModal);

    // Auto-test on filter change (debounced)
    let debounceTimeout;
    filterEditor.onDidChangeModelContent(() => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(testAllSamples, 500);
    });

    // Help drawer toggle
    document.getElementById('helpToggle').addEventListener('click', () => {
        if (typeof toggleHelpDrawer === 'function') toggleHelpDrawer();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
            e.preventDefault();
            if (typeof toggleHelpDrawer === 'function') toggleHelpDrawer();
        } else if (mod && e.key === 'Enter') {
            e.preventDefault();
            testAllSamples();
        } else if (mod && e.key === 's') {
            e.preventDefault();
            saveFilter();
        } else if (e.key === 'Escape') {
            closeAddSampleModal();
        }
    });
}

// ---- Toast System ----

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// ---- Empty state ----

function updateEmptyState(filterCount) {
    const emptyState = document.getElementById('emptyState');
    const filtersList = document.getElementById('filtersList');
    if (filterCount === 0) {
        emptyState.style.display = 'flex';
        filtersList.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        filtersList.style.display = 'block';
    }
}

// ---- Delete button visibility ----

function updateDeleteButton() {
    document.getElementById('deleteBtn').style.display = currentFilter ? 'inline-flex' : 'none';
}

// ---- Webhook URL ----

function updateWebhookUrl() {
    const el = document.getElementById('webhookUrl');
    const textEl = document.getElementById('webhookUrlText');
    if (currentFilter) {
        const url = `${window.location.origin}/webhook/${currentFilter.value}`;
        textEl.textContent = `POST ${url}`;
        el.style.display = 'flex';
    } else {
        el.style.display = 'none';
    }
}

function copyWebhookUrl() {
    if (!currentFilter) return;
    const url = `${window.location.origin}/webhook/${currentFilter.value}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Webhook URL copied', 'success');
    });
}

// ---- Samples Table ----

function renderSamples() {
    const tbody = document.getElementById('samplesBody');
    const empty = document.getElementById('samplesEmpty');
    const clearBtn = document.getElementById('clearSamplesBtn');

    if (samples.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        clearBtn.style.display = 'none';
        document.getElementById('sampleCount').style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    clearBtn.style.display = currentFilter ? 'inline-flex' : 'none';

    // Update count badge
    const maxSamples = parseInt(document.getElementById('maxSamples').value) || 100;
    const badge = document.getElementById('sampleCount');
    badge.textContent = `${samples.length} / ${maxSamples}`;
    badge.style.display = 'inline';
    badge.classList.toggle('at-limit', samples.length >= maxSamples);

    tbody.innerHTML = samples.map((s, i) => {
        const statusClass = s.error ? 'error' : (s.result !== undefined ? 'success' : 'pending');
        const outputText = s.error
            ? `Error: ${escapeHtml(s.error)}`
            : (s.result !== undefined ? escapeHtml(JSON.stringify(s.result, null, 2)) : '');
        const labelHtml = s.label ? `<span class="sample-label">${escapeHtml(s.label)}</span><br>` : '';
        const tsHtml = s.received_at ? `<span class="sample-ts">${new Date(s.received_at).toLocaleString()}</span>` : '';

        return `<tr data-index="${i}" class="${expandedSampleIds.has(s.id) ? '' : 'collapsed'}">
            <td><span class="row-chevron">&#9654;</span><span class="status-dot ${statusClass}"></span></td>
            <td class="sample-cell">
                ${labelHtml}<pre>${escapeHtml(formatJson(s.payload))}</pre>${tsHtml}
            </td>
            <td class="sample-cell ${statusClass}">
                <pre>${outputText}</pre>
            </td>
            <td>
                <button class="sample-action-btn sample-copy-btn" data-index="${i}" title="Copy payload">⎘</button>
                <button class="sample-action-btn sample-edit-btn" data-index="${i}" title="Edit sample">✎</button>
                <button class="sample-delete-btn" data-sample-id="${s.id}" title="Delete sample">&times;</button>
            </td>
        </tr>`;
    }).join('');

    // Attach row toggle handlers (ignore text selections and delete clicks)
    tbody.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', (e) => {
            if (e.target.closest('.sample-delete-btn') || e.target.closest('.sample-action-btn')) return;
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;
            tr.classList.toggle('collapsed');
            const idx = Number(tr.dataset.index);
            const sampleId = samples[idx]?.id;
            if (sampleId != null) {
                if (tr.classList.contains('collapsed')) {
                    expandedSampleIds.delete(sampleId);
                } else {
                    expandedSampleIds.add(sampleId);
                }
            }
        });
    });

    // Attach delete handlers
    tbody.querySelectorAll('.sample-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteSample(btn.dataset.sampleId));
    });

    // Attach copy handlers
    tbody.querySelectorAll('.sample-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const s = samples[Number(btn.dataset.index)];
            if (s) copySamplePayload(s.payload);
        });
    });

    // Attach edit handlers
    tbody.querySelectorAll('.sample-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const s = samples[Number(btn.dataset.index)];
            if (s) openEditSampleModal(s.id, s.payload);
        });
    });
}

function formatJson(str) {
    try {
        return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
        return str;
    }
}

// ---- Add Sample Modal ----

function openAddSampleModal() {
    if (!currentFilter) {
        showToast('Save the filter first before adding samples', 'error');
        return;
    }
    document.getElementById('addSampleModal').style.display = 'flex';
    document.getElementById('sampleInput').value = '';
    document.getElementById('sampleInput').focus();
}

function closeAddSampleModal() {
    editingSampleId = null;
    document.getElementById('sampleModalTitle').textContent = 'Add Sample';
    document.getElementById('addSampleModal').style.display = 'none';
}

function openEditSampleModal(sampleId, payload) {
    editingSampleId = sampleId;
    document.getElementById('sampleModalTitle').textContent = 'Edit Sample';
    document.getElementById('sampleInput').value = formatJson(payload);
    document.getElementById('addSampleModal').style.display = 'flex';
    document.getElementById('sampleInput').focus();
}

async function addSample() {
    if (!currentFilter) return;
    const input = document.getElementById('sampleInput').value.trim();
    if (!input) {
        showToast('Please enter JSON data', 'error');
        return;
    }
    try {
        JSON.parse(input);
    } catch {
        showToast('Invalid JSON', 'error');
        return;
    }

    if (editingSampleId) {
        try {
            const response = await apiFetch(`/api/filters/${currentFilter.id}/samples/${editingSampleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload: input }),
            });
            if (response.ok) {
                closeAddSampleModal();
                await loadSamples();
                testAllSamples();
                showToast('Sample updated', 'success');
            } else {
                const err = await response.json();
                showToast(`Error: ${err.detail}`, 'error');
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        }
        return;
    }

    try {
        const response = await apiFetch(`/api/filters/${currentFilter.id}/samples`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: input })
        });
        if (response.ok) {
            const newSample = await response.json();
            expandedSampleIds.add(newSample.id);
            closeAddSampleModal();
            await loadSamples();
            testAllSamples();
            showToast('Sample added', 'success');
        } else {
            const err = await response.json();
            showToast(`Error: ${err.detail}`, 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

function copySamplePayload(payload) {
    navigator.clipboard.writeText(formatJson(payload)).then(() => {
        showToast('Payload copied', 'success');
    });
}

async function deleteSample(sampleId) {
    try {
        const response = await apiFetch(`/api/filters/${currentFilter.id}/samples/${sampleId}`, { method: 'DELETE' });
        if (response.ok || response.status === 204) {
            samples = samples.filter(s => s.id !== sampleId);
            renderSamples();
            showToast('Sample deleted', 'info');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function clearAllSamples() {
    if (!currentFilter || samples.length === 0) return;
    try {
        const response = await apiFetch(`/api/filters/${currentFilter.id}/samples`, { method: 'DELETE' });
        if (response.ok || response.status === 204) {
            samples = [];
            expandedSampleIds.clear();
            renderSamples();
            showToast('All samples cleared', 'info');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function loadSamples() {
    if (!currentFilter) {
        samples = [];
        renderSamples();
        return;
    }
    try {
        const response = await apiFetch(`/api/filters/${currentFilter.id}/samples`);
        const data = await response.json();
        samples = data.map(s => ({
            id: s.id,
            payload: s.payload,
            label: s.label,
            received_at: s.received_at,
            result: undefined,
            error: null
        }));
        renderSamples();
    } catch (error) {
        console.error('Error loading samples:', error);
    }
}

// ---- Sample Polling ----

function startSamplePolling() {
    stopSamplePolling();
    if (!currentFilter) return;
    pollInterval = setInterval(async () => {
        if (!currentFilter) return;
        try {
            const response = await apiFetch(`/api/filters/${currentFilter.id}/samples`);
            const data = await response.json();
            const newIds = new Set(data.map(s => s.id));
            const currentIds = new Set(samples.map(s => s.id));
            if (newIds.size !== currentIds.size || [...newIds].some(id => !currentIds.has(id))) {
                // Mark genuinely new samples as expanded
                for (const id of newIds) {
                    if (!currentIds.has(id)) {
                        expandedSampleIds.add(id);
                    }
                }
                await loadSamples();
                testAllSamples();
            }
        } catch (error) {
            console.error('Poll error:', error);
        }
    }, 3000);
}

function stopSamplePolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// ---- Test All Samples ----

async function testAllSamples() {
    if (samples.length === 0) return;

    const filterExpression = filterEditor.getValue();
    const inputs = samples.map(s => s.payload);

    try {
        const response = await apiFetch('/api/test-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filter_expression: filterExpression, inputs })
        });

        const data = await response.json();

        data.results.forEach((r, i) => {
            if (i < samples.length) {
                samples[i].result = r.result;
                samples[i].error = r.error;
            }
        });

        renderSamples();
    } catch (error) {
        showToast(`Test error: ${error.message}`, 'error');
    }
}

// ---- API Functions ----

async function saveFilter() {
    const name = document.getElementById('filterName').value;
    const description = document.getElementById('filterDescription').value;
    const filterExpression = filterEditor.getValue();
    const filterValue = document.getElementById('filterValue').value;
    if (!name) {
        showToast('Please provide a name for the filter', 'error');
        return;
    }

    try {
        const method = currentFilter ? 'PUT' : 'POST';
        const url = currentFilter
            ? `/api/filters/${currentFilter.id}`
            : '/api/filters';

        const response = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description,
                filter_expression: filterExpression,
                value: filterValue,
                max_samples: parseInt(document.getElementById('maxSamples').value) || 100,
                retention_days: parseInt(document.getElementById('retentionDays').value) || null,
                enabled: document.getElementById('filterEnabled').dataset.enabled === 'true',
            })
        });

        if (response.ok) {
            const data = await response.json();
            currentFilter = data;
            updateDeleteButton();
            updateWebhookUrl();
            updateOwnershipUI();
            await loadSavedFilters();
            await loadSamples();
            testAllSamples();
            startSamplePolling();
            if (data.max_samples < samples.length) {
                showToast(`Trimming to ${data.max_samples} samples\u2026`, 'info');
            }
            showToast('Filter saved', 'success');
        } else {
            const error = await response.json();
            showToast(`Error: ${error.detail || error.error}`, 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function deleteFilter() {
    if (!currentFilter) return;

    try {
        const response = await apiFetch(`/api/filters/${currentFilter.id}`, {
            method: 'DELETE'
        });

        if (response.ok || response.status === 204) {
            showToast('Filter deleted', 'info');
            newFilter();
        } else {
            const error = await response.json();
            showToast(`Error: ${error.detail || 'Failed to delete'}`, 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function loadSavedFilters() {
    try {
        const response = await apiFetch('/api/filters');
        const filters = await response.json();

        const filtersList = document.getElementById('filtersList');
        filtersList.innerHTML = '';

        updateEmptyState(filters.length);

        filters.forEach(filter => {
            const filterElement = document.createElement('div');
            filterElement.className = `filter-item ${currentFilter?.id === filter.id ? 'active' : ''}`;
            let isShared;
            if (authDisabled && devUser) {
                const devUid = "dev_" + devUser.replace("@", "_at_").replace(/\./g, "_");
                isShared = filter.owner_uid && filter.owner_uid !== devUid;
            } else {
                isShared = filter.owner_uid && currentUser && filter.owner_uid !== currentUser.uid;
            }
            const isPaused = filter.enabled === false;
            filterElement.innerHTML = `
                <div class="filter-item-content">
                    <div class="filter-item-name">${escapeHtml(filter.name)}${isShared ? '<span class="filter-shared-badge">shared</span>' : ''}${isPaused ? '<span class="filter-disabled-badge">paused</span>' : ''}</div>
                    <div class="filter-item-desc">${escapeHtml(filter.description || '')}</div>
                </div>
                <button class="filter-item-delete" title="Delete filter">&times;</button>
            `;

            filterElement.addEventListener('click', (e) => {
                if (e.target.closest('.filter-item-delete')) return;
                loadFilter(filter);
            });

            filterElement.querySelector('.filter-item-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFilterById(filter.id, filter.name);
            });

            filtersList.appendChild(filterElement);
        });
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

async function deleteFilterById(id, name) {
    try {
        const response = await apiFetch(`/api/filters/${id}`, { method: 'DELETE' });
        if (response.ok || response.status === 204) {
            showToast(`Deleted "${name}"`, 'info');
            if (currentFilter?.id === id) {
                newFilter();
            } else {
                await loadSavedFilters();
            }
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function loadFilter(filter) {
    currentFilter = filter;
    document.getElementById('filterName').value = filter.name;
    document.getElementById('filterValue').value = filter.value;
    document.getElementById('filterDescription').value = filter.description || '';
    document.getElementById('maxSamples').value = filter.max_samples ?? 100;
    document.getElementById('retentionDays').value = filter.retention_days ?? '';
    setEnabledToggle(filter.enabled ?? true);
    filterEditor.setValue(filter.filter_expression);
    updateDeleteButton();
    updateWebhookUrl();
    updateOwnershipUI();
    await loadSavedFilters();
    await loadSamples();
    testAllSamples();
    startSamplePolling();
}

function newFilter() {
    stopSamplePolling();
    currentFilter = null;
    document.getElementById('filterName').value = '';
    document.getElementById('filterValue').value = '';
    document.getElementById('filterDescription').value = '';
    document.getElementById('maxSamples').value = 100;
    document.getElementById('retentionDays').value = '';
    setEnabledToggle(true);
    filterEditor.setValue('.');
    samples = [];
    expandedSampleIds.clear();
    renderSamples();
    updateDeleteButton();
    updateWebhookUrl();
    updateOwnershipUI();
    loadSavedFilters();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ---- Enabled Toggle ----

function setEnabledToggle(enabled) {
    const btn = document.getElementById('filterEnabled');
    btn.dataset.enabled = enabled;
    btn.textContent = enabled ? '● On' : '○ Off';
    btn.classList.toggle('active', enabled);
}

// ---- Ownership & Share Panel ----

function updateOwnershipUI() {
    let isOwner;
    if (!currentFilter || !currentFilter.owner_uid) {
        isOwner = true;
    } else if (authDisabled && devUser) {
        const devUid = "dev_" + devUser.replace("@", "_at_").replace(/\./g, "_");
        isOwner = currentFilter.owner_uid === devUid;
    } else {
        isOwner = currentUser && currentFilter.owner_uid === currentUser.uid;
    }

    document.getElementById('saveBtn').disabled = currentFilter ? !isOwner : false;
    document.getElementById('deleteBtn').disabled = currentFilter ? !isOwner : false;

    const panel = document.getElementById('sharePanel');
    if (!panel) return;

    // Show share panel for owners of saved filters (in dev mode too)
    if (currentFilter && isOwner && (authDisabled || currentUser)) {
        panel.style.display = 'block';
        renderSharedWithList();
    } else {
        panel.style.display = 'none';
    }
}

function renderSharedWithList() {
    const list = document.getElementById('sharedWithList');
    if (!list || !currentFilter) return;
    const emails = currentFilter.shared_with || [];
    if (emails.length === 0) {
        list.innerHTML = '<div class="shared-with-empty">Not shared with anyone yet.</div>';
        return;
    }
    list.innerHTML = emails.map(email => `
        <div class="shared-with-item">
            <span>${escapeHtml(email)}</span>
            <button class="share-remove-btn" data-email="${escapeHtml(email)}" title="Remove">&times;</button>
        </div>
    `).join('');
    list.querySelectorAll('.share-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => unshareEmail(btn.dataset.email));
    });
}

async function shareEmail() {
    const input = document.getElementById('shareEmailInput');
    const email = input.value.trim();
    if (!email || !currentFilter) return;
    try {
        const response = await apiFetch(`/api/filters/${currentFilter.id}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (response.ok) {
            const data = await response.json();
            currentFilter.shared_with = data.shared_with;
            input.value = '';
            renderSharedWithList();
            showToast(`Shared with ${email}`, 'success');
        } else {
            const err = await response.json();
            showToast(`Error: ${err.detail}`, 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function unshareEmail(email) {
    if (!currentFilter) return;
    try {
        const response = await apiFetch(`/api/filters/${currentFilter.id}/share/${encodeURIComponent(email)}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            const data = await response.json();
            currentFilter.shared_with = data.shared_with;
            renderSharedWithList();
            showToast(`Removed ${email}`, 'info');
        } else {
            const err = await response.json();
            showToast(`Error: ${err.detail}`, 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}
