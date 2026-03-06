// Monaco Editor configuration
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' } });

let filterEditor;
let currentFilter = null;
let samples = []; // { id, payload, label, result, error }
let expandedSampleIds = new Set();
let pollInterval = null;

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
    filterEditor = monaco.editor.create(document.getElementById('filterEditor'), {
        value: '.',
        language: 'plaintext',
        ...editorOptions
    });

    setupEventListeners();
    loadSavedFilters();

    window.addEventListener('resize', () => {
        filterEditor.layout();
    });
});

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
    document.querySelector('.modal-backdrop').addEventListener('click', closeAddSampleModal);

    // Auto-test on filter change (debounced)
    let debounceTimeout;
    filterEditor.onDidChangeModelContent(() => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(testAllSamples, 500);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key === 'Enter') {
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
        const url = `${window.location.origin}/webhook/${currentFilter.id}`;
        textEl.textContent = `POST ${url}`;
        el.style.display = 'flex';
    } else {
        el.style.display = 'none';
    }
}

function copyWebhookUrl() {
    if (!currentFilter) return;
    const url = `${window.location.origin}/webhook/${currentFilter.id}`;
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
        return;
    }

    empty.style.display = 'none';
    clearBtn.style.display = currentFilter ? 'inline-flex' : 'none';
    tbody.innerHTML = samples.map((s, i) => {
        const statusClass = s.error ? 'error' : (s.result !== undefined ? 'success' : 'pending');
        const outputText = s.error
            ? `Error: ${escapeHtml(s.error)}`
            : (s.result !== undefined ? escapeHtml(JSON.stringify(s.result, null, 2)) : '');
        const labelHtml = s.label ? `<span class="sample-label">${escapeHtml(s.label)}</span><br>` : '';

        return `<tr data-index="${i}" class="${expandedSampleIds.has(s.id) ? '' : 'collapsed'}">
            <td><span class="row-chevron">&#9654;</span><span class="status-dot ${statusClass}"></span></td>
            <td class="sample-cell">
                ${labelHtml}<pre>${escapeHtml(formatJson(s.payload))}</pre>
            </td>
            <td class="sample-cell ${statusClass}">
                <pre>${outputText}</pre>
            </td>
            <td>
                <button class="sample-delete-btn" data-sample-id="${s.id}" title="Delete sample">&times;</button>
            </td>
        </tr>`;
    }).join('');

    // Attach row toggle handlers (ignore text selections and delete clicks)
    tbody.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', (e) => {
            if (e.target.closest('.sample-delete-btn')) return;
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;
            tr.classList.toggle('collapsed');
            const idx = parseInt(tr.dataset.index);
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
        btn.addEventListener('click', () => deleteSample(parseInt(btn.dataset.sampleId)));
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
    document.getElementById('addSampleModal').style.display = 'none';
}

async function addSample() {
    if (!currentFilter) return;
    const input = document.getElementById('sampleInput').value.trim();
    if (!input) {
        showToast('Please enter JSON data', 'error');
        return;
    }
    // Validate JSON
    try {
        JSON.parse(input);
    } catch {
        showToast('Invalid JSON', 'error');
        return;
    }
    try {
        const response = await fetch(`/api/filters/${currentFilter.id}/samples`, {
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

async function deleteSample(sampleId) {
    try {
        const response = await fetch(`/api/samples/${sampleId}`, { method: 'DELETE' });
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
        const response = await fetch(`/api/filters/${currentFilter.id}/samples`, { method: 'DELETE' });
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
        const response = await fetch(`/api/filters/${currentFilter.id}/samples`);
        const data = await response.json();
        samples = data.map(s => ({
            id: s.id,
            payload: s.payload,
            label: s.label,
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
            const response = await fetch(`/api/filters/${currentFilter.id}/samples`);
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
        const response = await fetch('/api/test-bulk', {
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

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description,
                filter_expression: filterExpression,
                value: filterValue
            })
        });

        if (response.ok) {
            const data = await response.json();
            currentFilter = data;
            updateDeleteButton();
            updateWebhookUrl();
            await loadSavedFilters();
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
        const response = await fetch(`/api/filters/${currentFilter.id}`, {
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
        const response = await fetch('/api/filters');
        const filters = await response.json();

        const filtersList = document.getElementById('filtersList');
        filtersList.innerHTML = '';

        updateEmptyState(filters.length);

        filters.forEach(filter => {
            const filterElement = document.createElement('div');
            filterElement.className = `filter-item ${currentFilter?.id === filter.id ? 'active' : ''}`;
            filterElement.innerHTML = `
                <div class="filter-item-content">
                    <div class="filter-item-name">${escapeHtml(filter.name)}</div>
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
        const response = await fetch(`/api/filters/${id}`, { method: 'DELETE' });
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
    filterEditor.setValue(filter.filter_expression);
    updateDeleteButton();
    updateWebhookUrl();
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
    filterEditor.setValue('.');
    samples = [];
    expandedSampleIds.clear();
    renderSamples();
    updateDeleteButton();
    updateWebhookUrl();
    loadSavedFilters();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
