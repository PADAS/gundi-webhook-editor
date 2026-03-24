// jq language support for Monaco Editor
window.registerJqLanguage = function () {
    monaco.languages.register({ id: 'jq' });

    monaco.languages.setMonarchTokensProvider('jq', {
        keywords: [
            'def', 'as', 'if', 'then', 'elif', 'else', 'end',
            'reduce', 'foreach', 'try', 'catch', 'import', 'include',
            'label', 'break', 'and', 'or', 'not', 'true', 'false', 'null'
        ],
        builtins: [
            'length', 'utf8bytelength', 'keys', 'keys_unsorted', 'values',
            'has', 'in', 'getpath', 'setpath', 'delpaths',
            'to_entries', 'from_entries', 'with_entries',
            'map', 'map_values', 'select', 'empty', 'error',
            'add', 'any', 'all', 'flatten', 'range', 'floor', 'ceil', 'round',
            'sqrt', 'pow', 'fabs', 'nan', 'isinfinite', 'isnan', 'infinite',
            'sort', 'sort_by', 'group_by', 'unique', 'unique_by',
            'max', 'max_by', 'min', 'min_by',
            'reverse', 'contains', 'inside', 'startswith', 'endswith',
            'ltrimstr', 'rtrimstr', 'split', 'join',
            'ascii_downcase', 'ascii_upcase',
            'tostring', 'tonumber', 'type', 'infinite',
            'recurse', 'recurse_down', 'env', 'transpose',
            'input', 'inputs', 'debug', 'stderr',
            'path', 'paths', 'leaf_paths',
            'limit', 'first', 'last', 'nth', 'indices', 'index', 'rindex',
            'builtins', 'ascii', 'explode', 'implode',
            'tojson', 'fromjson',
            'test', 'match', 'capture', 'scan', 'sub', 'gsub',
            'splits', 'todate', 'fromdate', 'now', 'strftime', 'strptime',
            'halt', 'halt_error',
            'objects', 'arrays', 'strings', 'numbers', 'booleans', 'nulls',
            'iterables', 'scalars', 'normals',
            'not', 'alternative', 'label', 'foreach',
            'repeat', 'until', 'while',
            'input_line_number', 'debug', 'modulemeta',
            'del', 'ascii_downcase', 'ascii_upcase',
            'ltrimstr', 'rtrimstr',
            'limit', 'isempty', 'infinite', 'nan',
            'getpath', 'setpath', 'delpaths',
            'leaf_paths', 'path',
            'env', 'builtins'
        ],
        formatStrings: [
            '@csv', '@tsv', '@json', '@text', '@html', '@uri', '@base32', '@base64', '@base64d'
        ],
        operators: ['|', '//', '?//', '=', '!=', '<', '>', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '//='],
        symbols: /[=><!~?:&|+\-*\/\^%]+/,

        tokenizer: {
            root: [
                // Comments
                [/#.*$/, 'comment'],

                // Format strings
                [/@(csv|tsv|json|text|html|uri|base32|base64d|base64)/, 'keyword'],

                // Strings
                [/"/, 'string', '@string'],

                // Numbers
                [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],

                // Dot access
                [/\.[a-zA-Z_]\w*/, 'variable'],

                // Identifiers
                [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@builtins': 'type.identifier',
                        '@default': 'identifier'
                    }
                }],

                // Operators
                [/\|/, 'delimiter'],
                [/\/\//, 'operator'],
                [/[?]/, 'operator'],
                [/[;,]/, 'delimiter'],
                [/[(){}[\]]/, '@brackets'],
                [/@symbols/, 'operator'],

                // Whitespace
                [/\s+/, 'white'],
            ],
            string: [
                [/[^"\\]+/, 'string'],
                [/\\\(/, 'string.escape', '@interpolation'],
                [/\\./, 'string.escape'],
                [/"/, 'string', '@pop'],
            ],
            interpolation: [
                [/\)/, 'string.escape', '@pop'],
                { include: 'root' }
            ]
        }
    });

    // Completion provider
    const builtinCompletions = [
        { label: 'length', detail: 'Get length of value', insertText: 'length' },
        { label: 'keys', detail: 'Get keys of object', insertText: 'keys' },
        { label: 'values', detail: 'Get values of object', insertText: 'values' },
        { label: 'has', detail: 'Check if key exists', insertText: 'has("${1:key}")' },
        { label: 'in', detail: 'Check if key is in object', insertText: 'in(${1:object})' },
        { label: 'map', detail: 'Apply filter to each element', insertText: 'map(${1:.})' },
        { label: 'map_values', detail: 'Apply filter to each value', insertText: 'map_values(${1:.})' },
        { label: 'select', detail: 'Filter elements by condition', insertText: 'select(${1:condition})' },
        { label: 'empty', detail: 'Produce no output', insertText: 'empty' },
        { label: 'error', detail: 'Raise an error', insertText: 'error("${1:message}")' },
        { label: 'add', detail: 'Sum/concatenate elements', insertText: 'add' },
        { label: 'any', detail: 'Check if any element matches', insertText: 'any(${1:condition})' },
        { label: 'all', detail: 'Check if all elements match', insertText: 'all(${1:condition})' },
        { label: 'flatten', detail: 'Flatten nested arrays', insertText: 'flatten' },
        { label: 'range', detail: 'Generate number range', insertText: 'range(${1:n})' },
        { label: 'sort', detail: 'Sort array', insertText: 'sort' },
        { label: 'sort_by', detail: 'Sort array by expression', insertText: 'sort_by(${1:.key})' },
        { label: 'group_by', detail: 'Group array by expression', insertText: 'group_by(${1:.key})' },
        { label: 'unique', detail: 'Remove duplicate elements', insertText: 'unique' },
        { label: 'unique_by', detail: 'Remove duplicates by expression', insertText: 'unique_by(${1:.key})' },
        { label: 'max_by', detail: 'Maximum by expression', insertText: 'max_by(${1:.key})' },
        { label: 'min_by', detail: 'Minimum by expression', insertText: 'min_by(${1:.key})' },
        { label: 'reverse', detail: 'Reverse array', insertText: 'reverse' },
        { label: 'contains', detail: 'Check if value contains another', insertText: 'contains(${1:value})' },
        { label: 'startswith', detail: 'Check string prefix', insertText: 'startswith("${1:str}")' },
        { label: 'endswith', detail: 'Check string suffix', insertText: 'endswith("${1:str}")' },
        { label: 'ltrimstr', detail: 'Remove string prefix', insertText: 'ltrimstr("${1:str}")' },
        { label: 'rtrimstr', detail: 'Remove string suffix', insertText: 'rtrimstr("${1:str}")' },
        { label: 'split', detail: 'Split string by separator', insertText: 'split("${1:sep}")' },
        { label: 'join', detail: 'Join array with separator', insertText: 'join("${1:sep}")' },
        { label: 'ascii_downcase', detail: 'Convert to lowercase', insertText: 'ascii_downcase' },
        { label: 'ascii_upcase', detail: 'Convert to uppercase', insertText: 'ascii_upcase' },
        { label: 'tostring', detail: 'Convert to string', insertText: 'tostring' },
        { label: 'tonumber', detail: 'Convert to number', insertText: 'tonumber' },
        { label: 'type', detail: 'Get type of value', insertText: 'type' },
        { label: 'to_entries', detail: 'Object to key-value pairs', insertText: 'to_entries' },
        { label: 'from_entries', detail: 'Key-value pairs to object', insertText: 'from_entries' },
        { label: 'with_entries', detail: 'Transform object entries', insertText: 'with_entries(${1:.value})' },
        { label: 'recurse', detail: 'Recursively descend', insertText: 'recurse' },
        { label: 'path', detail: 'Get path to value', insertText: 'path(${1:.key})' },
        { label: 'paths', detail: 'Get all paths', insertText: 'paths' },
        { label: 'leaf_paths', detail: 'Get paths to leaf values', insertText: 'leaf_paths' },
        { label: 'getpath', detail: 'Get value at path', insertText: 'getpath(${1:path})' },
        { label: 'setpath', detail: 'Set value at path', insertText: 'setpath(${1:path}; ${2:value})' },
        { label: 'delpaths', detail: 'Delete values at paths', insertText: 'delpaths(${1:paths})' },
        { label: 'del', detail: 'Delete a key', insertText: 'del(${1:.key})' },
        { label: 'indices', detail: 'Find indices of value', insertText: 'indices(${1:value})' },
        { label: 'index', detail: 'Find first index of value', insertText: 'index(${1:value})' },
        { label: 'first', detail: 'Get first element', insertText: 'first' },
        { label: 'last', detail: 'Get last element', insertText: 'last' },
        { label: 'limit', detail: 'Limit number of outputs', insertText: 'limit(${1:n}; ${2:.[]})' },
        { label: 'test', detail: 'Test regex match', insertText: 'test("${1:regex}")' },
        { label: 'match', detail: 'Match regex', insertText: 'match("${1:regex}")' },
        { label: 'capture', detail: 'Capture regex groups', insertText: 'capture("${1:regex}")' },
        { label: 'scan', detail: 'Scan for regex matches', insertText: 'scan("${1:regex}")' },
        { label: 'sub', detail: 'Replace first regex match', insertText: 'sub("${1:regex}"; "${2:replacement}")' },
        { label: 'gsub', detail: 'Replace all regex matches', insertText: 'gsub("${1:regex}"; "${2:replacement}")' },
        { label: 'tojson', detail: 'Serialize to JSON string', insertText: 'tojson' },
        { label: 'fromjson', detail: 'Parse JSON string', insertText: 'fromjson' },
        { label: 'todate', detail: 'Convert epoch to date string', insertText: 'todate' },
        { label: 'fromdate', detail: 'Convert date string to epoch', insertText: 'fromdate' },
        { label: 'now', detail: 'Current time as epoch', insertText: 'now' },
        { label: 'debug', detail: 'Debug output to stderr', insertText: 'debug' },
        { label: 'input', detail: 'Read next input', insertText: 'input' },
        { label: 'env', detail: 'Environment variables', insertText: 'env' },
        { label: 'transpose', detail: 'Transpose array of arrays', insertText: 'transpose' },
        { label: 'floor', detail: 'Round down', insertText: 'floor' },
        { label: 'ceil', detail: 'Round up', insertText: 'ceil' },
        { label: 'round', detail: 'Round to nearest integer', insertText: 'round' },
        { label: 'sqrt', detail: 'Square root', insertText: 'sqrt' },
        { label: 'objects', detail: 'Select only objects', insertText: 'objects' },
        { label: 'arrays', detail: 'Select only arrays', insertText: 'arrays' },
        { label: 'strings', detail: 'Select only strings', insertText: 'strings' },
        { label: 'numbers', detail: 'Select only numbers', insertText: 'numbers' },
        { label: 'booleans', detail: 'Select only booleans', insertText: 'booleans' },
        { label: 'nulls', detail: 'Select only nulls', insertText: 'nulls' },
        { label: 'not', detail: 'Boolean negation', insertText: 'not' },
        { label: 'explode', detail: 'String to codepoints', insertText: 'explode' },
        { label: 'implode', detail: 'Codepoints to string', insertText: 'implode' },
        { label: 'isnan', detail: 'Check if NaN', insertText: 'isnan' },
        { label: 'isinfinite', detail: 'Check if infinite', insertText: 'isinfinite' },
    ];

    // Snippet completions
    const snippetCompletions = [
        { label: 'map(select(.))', detail: 'Filter array elements', insertText: 'map(select(${1:condition}))' },
        { label: '.[] | ', detail: 'Iterate and pipe', insertText: '.[] | ${1}' },
        { label: 'group_by(.) | map(...)', detail: 'Group and transform', insertText: 'group_by(${1:.key}) | map({key: .[0].${1:.key}, values: .})' },
        { label: 'to_entries | map(...) | from_entries', detail: 'Transform object keys/values', insertText: 'to_entries | map(${1:.}) | from_entries' },
        { label: 'reduce .[] as $x', detail: 'Reduce array to value', insertText: 'reduce .[] as $$x (${1:init}; ${2:update})' },
        { label: 'if-then-else', detail: 'Conditional expression', insertText: 'if ${1:condition} then ${2:value} else ${3:value} end' },
        { label: 'try-catch', detail: 'Error handling', insertText: 'try ${1:expr} catch ${2:handler}' },
        { label: 'def fn', detail: 'Define function', insertText: 'def ${1:name}: ${2:body};' },
        { label: 'def fn(arg)', detail: 'Define function with argument', insertText: 'def ${1:name}(${2:arg}): ${3:body};' },
        { label: '{key: .field}', detail: 'Object construction', insertText: '{${1:key}: .${2:field}}' },
        { label: '[.[] | ...]', detail: 'Array comprehension', insertText: '[.[] | ${1:expr}]' },
        { label: 'walk(if ... then ... else . end)', detail: 'Recursive walk', insertText: 'walk(if type == "${1:string}" then ${2:expr} else . end)' },
        { label: '@base64', detail: 'Base64 encode', insertText: '@base64' },
        { label: '@base64d', detail: 'Base64 decode', insertText: '@base64d' },
        { label: '@csv', detail: 'Format as CSV', insertText: '@csv' },
        { label: '@tsv', detail: 'Format as TSV', insertText: '@tsv' },
        { label: '@json', detail: 'Format as JSON string', insertText: '@json' },
        { label: '@html', detail: 'HTML-escape string', insertText: '@html' },
        { label: '@uri', detail: 'URI-escape string', insertText: '@uri' },
    ];

    // Document formatter
    function breakLongLine(line, maxWidth) {
        if (line.length <= maxWidth) return line;

        let depth = 0;
        let inString = false;
        let escaped = false;
        const breakPoints = [];

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (escaped) { escaped = false; continue; }
            if (ch === '\\' && inString) { escaped = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if ('([{'.includes(ch)) { depth++; continue; }
            if (')]}'.includes(ch)) { depth--; continue; }
            if (ch === ',' && depth === 1) breakPoints.push(i);
        }

        if (breakPoints.length === 0) return line;

        const baseIndent = line.match(/^(\s*)/)[1];
        const innerIndent = baseIndent + '  ';

        let result = '';
        let last = 0;
        for (const bp of breakPoints) {
            result += line.slice(last, bp + 1).trimEnd() + '\n' + innerIndent;
            last = bp + 1;
            while (last < line.length && line[last] === ' ') last++;
        }
        result += line.slice(last);
        return result;
    }

    function formatJq(text, maxWidth = 80) {
        text = text.trim();
        let result = '';
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (escaped) { result += ch; escaped = false; continue; }
            if (ch === '\\' && inString) { result += ch; escaped = true; continue; }
            if (ch === '"') { inString = !inString; result += ch; continue; }
            if (inString) { result += ch; continue; }

            if ('([{'.includes(ch)) { depth++; result += ch; continue; }
            if (')]}'.includes(ch)) { depth--; result += ch; continue; }

            if (ch === '|' && depth === 0) {
                const tail = result.trimEnd();
                // Don't split // or ?// alternative operators
                if (tail.endsWith('/') || tail.endsWith('?')) {
                    result += ch;
                } else if (text[i + 1] === '/') {
                    // Next char is '/', so this is start of //
                    result += ch;
                } else {
                    result = tail + '\n| ';
                }
                continue;
            }

            result += ch;
        }

        const lines = result
            .split('\n')
            .map(line => line.trim().replace(/\s{2,}/g, ' '))
            .filter((line, idx) => line || idx === 0);

        return lines
            .map(line => breakLongLine(line, maxWidth))
            .join('\n');
    }

    monaco.languages.registerDocumentFormattingEditProvider('jq', {
        provideDocumentFormattingEdits(model) {
            const formatted = formatJq(model.getValue());
            return [{
                range: model.getFullModelRange(),
                text: formatted,
            }];
        }
    });

    monaco.languages.registerCompletionItemProvider('jq', {
        provideCompletionItems: function (model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Check for @ prefix
            const lineContent = model.getLineContent(position.lineNumber);
            const charBefore = lineContent[position.column - 2];

            const suggestions = [];

            builtinCompletions.forEach(item => {
                suggestions.push({
                    label: item.label,
                    kind: monaco.languages.CompletionItemKind.Function,
                    detail: item.detail,
                    insertText: item.insertText,
                    insertTextRules: item.insertText.includes('$') ?
                        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range: range
                });
            });

            snippetCompletions.forEach(item => {
                suggestions.push({
                    label: item.label,
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    detail: item.detail,
                    insertText: item.insertText,
                    insertTextRules: item.insertText.includes('$') ?
                        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range: range
                });
            });

            return { suggestions };
        },
        triggerCharacters: ['.', '|', '@']
    });
};
