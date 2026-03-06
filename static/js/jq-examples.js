// jq examples data
window.JQ_EXAMPLES = [
    {
        category: 'Basics',
        examples: [
            {
                title: 'Identity filter',
                description: 'Pass input through unchanged',
                expression: '.',
                input: '{"name": "Alice", "age": 30}',
                expectedOutput: '{"name": "Alice", "age": 30}'
            },
            {
                title: 'Field access',
                description: 'Extract a single field from an object',
                expression: '.name',
                input: '{"name": "Alice", "age": 30}',
                expectedOutput: '"Alice"'
            },
            {
                title: 'Nested field access',
                description: 'Access deeply nested fields',
                expression: '.address.city',
                input: '{"name": "Alice", "address": {"city": "NYC", "zip": "10001"}}',
                expectedOutput: '"NYC"'
            },
            {
                title: 'Multiple fields',
                description: 'Extract multiple fields into a new object',
                expression: '{name: .name, city: .address.city}',
                input: '{"name": "Alice", "age": 30, "address": {"city": "NYC"}}',
                expectedOutput: '{"name": "Alice", "city": "NYC"}'
            },
            {
                title: 'Pipe filters',
                description: 'Chain filters together with the pipe operator',
                expression: '.items | length',
                input: '{"items": [1, 2, 3, 4, 5]}',
                expectedOutput: '5'
            }
        ]
    },
    {
        category: 'Arrays',
        examples: [
            {
                title: 'Iterate array',
                description: 'Get each element of an array',
                expression: '.[]',
                input: '[1, 2, 3]',
                expectedOutput: '1\n2\n3'
            },
            {
                title: 'Array index',
                description: 'Access specific array elements',
                expression: '.[1]',
                input: '["a", "b", "c"]',
                expectedOutput: '"b"'
            },
            {
                title: 'Array slice',
                description: 'Get a range of elements',
                expression: '.[1:3]',
                input: '["a", "b", "c", "d", "e"]',
                expectedOutput: '["b", "c"]'
            },
            {
                title: 'Map over array',
                description: 'Transform each element',
                expression: 'map(. * 2)',
                input: '[1, 2, 3, 4]',
                expectedOutput: '[2, 4, 6, 8]'
            },
            {
                title: 'Filter array elements',
                description: 'Keep only elements matching a condition',
                expression: 'map(select(. > 2))',
                input: '[1, 2, 3, 4, 5]',
                expectedOutput: '[3, 4, 5]'
            },
            {
                title: 'Sort array of objects',
                description: 'Sort objects by a field value',
                expression: 'sort_by(.age)',
                input: '[{"name": "Charlie", "age": 25}, {"name": "Alice", "age": 30}, {"name": "Bob", "age": 20}]',
                expectedOutput: '[{"name": "Bob", "age": 20}, {"name": "Charlie", "age": 25}, {"name": "Alice", "age": 30}]'
            },
            {
                title: 'Group and count',
                description: 'Group items and count each group',
                expression: 'group_by(.type) | map({type: .[0].type, count: length})',
                input: '[{"type": "a", "val": 1}, {"type": "b", "val": 2}, {"type": "a", "val": 3}]',
                expectedOutput: '[{"type": "a", "count": 2}, {"type": "b", "count": 1}]'
            },
            {
                title: 'Unique values',
                description: 'Remove duplicate elements',
                expression: 'unique',
                input: '[1, 2, 1, 3, 2, 4]',
                expectedOutput: '[1, 2, 3, 4]'
            },
            {
                title: 'Flatten nested arrays',
                description: 'Flatten arrays to a single level',
                expression: 'flatten',
                input: '[[1, 2], [3, [4, 5]], [6]]',
                expectedOutput: '[1, 2, 3, 4, 5, 6]'
            },
            {
                title: 'Sum array',
                description: 'Sum all numbers in an array',
                expression: 'add',
                input: '[10, 20, 30]',
                expectedOutput: '60'
            }
        ]
    },
    {
        category: 'Objects',
        examples: [
            {
                title: 'Get all keys',
                description: 'Get sorted list of object keys',
                expression: 'keys',
                input: '{"c": 3, "a": 1, "b": 2}',
                expectedOutput: '["a", "b", "c"]'
            },
            {
                title: 'Get all values',
                description: 'Get array of object values',
                expression: 'values',
                input: '{"a": 1, "b": 2, "c": 3}',
                expectedOutput: '[1, 2, 3]'
            },
            {
                title: 'Object to entries',
                description: 'Convert object to key-value pair array',
                expression: 'to_entries',
                input: '{"name": "Alice", "age": 30}',
                expectedOutput: '[{"key": "name", "value": "Alice"}, {"key": "age", "value": 30}]'
            },
            {
                title: 'Transform object values',
                description: 'Apply a transformation to all values',
                expression: 'map_values(. + 10)',
                input: '{"a": 1, "b": 2, "c": 3}',
                expectedOutput: '{"a": 11, "b": 12, "c": 13}'
            },
            {
                title: 'Delete a key',
                description: 'Remove a key from an object',
                expression: 'del(.password)',
                input: '{"name": "Alice", "password": "secret", "email": "alice@example.com"}',
                expectedOutput: '{"name": "Alice", "email": "alice@example.com"}'
            },
            {
                title: 'Merge objects',
                description: 'Merge two objects (right wins on conflicts)',
                expression: '.defaults * .overrides',
                input: '{"defaults": {"color": "red", "size": "M"}, "overrides": {"color": "blue"}}',
                expectedOutput: '{"color": "blue", "size": "M"}'
            },
            {
                title: 'Rename keys',
                description: 'Rename object keys using with_entries',
                expression: 'with_entries(if .key == "name" then .key = "title" else . end)',
                input: '{"name": "Alice", "age": 30}',
                expectedOutput: '{"title": "Alice", "age": 30}'
            }
        ]
    },
    {
        category: 'String Manipulation',
        examples: [
            {
                title: 'Split and join',
                description: 'Split a string and rejoin with different separator',
                expression: 'split(",") | join(" | ")',
                input: '"apple,banana,cherry"',
                expectedOutput: '"apple | banana | cherry"'
            },
            {
                title: 'String interpolation',
                description: 'Build a string from object fields',
                expression: '"\\(.name) is \\(.age) years old"',
                input: '{"name": "Alice", "age": 30}',
                expectedOutput: '"Alice is 30 years old"'
            },
            {
                title: 'Regex test',
                description: 'Check if string matches a pattern',
                expression: 'test("^[a-z]+@[a-z]+\\\\.[a-z]+$")',
                input: '"alice@example.com"',
                expectedOutput: 'true'
            },
            {
                title: 'Regex replace',
                description: 'Replace all matches of a pattern',
                expression: 'gsub("[0-9]+"; "N")',
                input: '"order123-item456"',
                expectedOutput: '"orderN-itemN"'
            },
            {
                title: 'Extract with regex',
                description: 'Extract named groups from a string',
                expression: 'capture("(?<name>[a-z]+)(?<num>[0-9]+)")',
                input: '"item42"',
                expectedOutput: '{"name": "item", "num": "42"}'
            }
        ]
    },
    {
        category: 'Advanced',
        examples: [
            {
                title: 'Reduce to sum',
                description: 'Use reduce to accumulate a value',
                expression: 'reduce .[] as $x (0; . + $x)',
                input: '[1, 2, 3, 4, 5]',
                expectedOutput: '15'
            },
            {
                title: 'Conditional transform',
                description: 'Apply different transforms based on conditions',
                expression: 'map(if . > 3 then "big" elif . > 1 then "medium" else "small" end)',
                input: '[1, 2, 3, 4, 5]',
                expectedOutput: '["small", "medium", "medium", "big", "big"]'
            },
            {
                title: 'Define and use a function',
                description: 'Create a reusable custom function',
                expression: 'def double: . * 2; map(double)',
                input: '[1, 2, 3]',
                expectedOutput: '[2, 4, 6]'
            },
            {
                title: 'Recursive descent',
                description: 'Find all numbers in a nested structure',
                expression: '[recurse | numbers]',
                input: '{"a": 1, "b": {"c": 2, "d": [3, "x", 4]}}',
                expectedOutput: '[1, 2, 3, 4]'
            },
            {
                title: 'Error handling with try',
                description: 'Handle errors gracefully',
                expression: '.[] | try tonumber catch "not a number"',
                input: '["1", "abc", "3"]',
                expectedOutput: '1\n"not a number"\n3'
            },
            {
                title: 'Pivot data',
                description: 'Transform rows into a lookup object',
                expression: 'map({(.name): .value}) | add',
                input: '[{"name": "a", "value": 1}, {"name": "b", "value": 2}, {"name": "c", "value": 3}]',
                expectedOutput: '{"a": 1, "b": 2, "c": 3}'
            },
            {
                title: 'Walking and transforming',
                description: 'Recursively transform all string values',
                expression: 'walk(if type == "string" then ascii_upcase else . end)',
                input: '{"name": "alice", "items": [{"tag": "foo"}, {"tag": "bar"}]}',
                expectedOutput: '{"name": "ALICE", "items": [{"tag": "FOO"}, {"tag": "BAR"}]}'
            },
            {
                title: 'CSV-like output',
                description: 'Format data as CSV rows',
                expression: '.[] | [.name, .age, .city] | @csv',
                input: '[{"name": "Alice", "age": 30, "city": "NYC"}, {"name": "Bob", "age": 25, "city": "LA"}]',
                expectedOutput: '"Alice",30,"NYC"\n"Bob",25,"LA"'
            }
        ]
    }
];
