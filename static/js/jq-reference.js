// jq language reference data
window.JQ_REFERENCE = [
    {
        category: 'Basic Filters',
        items: [
            { name: '.', description: 'Identity - returns the input unchanged', example: '. => input as-is' },
            { name: '.foo', description: 'Object field access', example: '.name => "John"' },
            { name: '.foo.bar', description: 'Nested field access', example: '.address.city => "NYC"' },
            { name: '.foo?', description: 'Optional field access (no error if missing)', example: '.missing? => null' },
            { name: '.["key"]', description: 'Field access with string key', example: '.["my-key"] => value' },
            { name: '.[]', description: 'Iterate all values', example: '[1,2,3] | .[] => 1, 2, 3' },
            { name: '.[n]', description: 'Array index access', example: '.[0] => first element' },
            { name: '.[n:m]', description: 'Array/string slice', example: '.[2:4] => elements 2-3' },
            { name: ',', description: 'Produce multiple outputs', example: '.a, .b => both values' },
            { name: '|', description: 'Pipe output to next filter', example: '.[] | .name => each name' },
        ]
    },
    {
        category: 'Types & Conversions',
        items: [
            { name: 'type', description: 'Get the type of a value as a string', example: '"hello" | type => "string"' },
            { name: 'tostring', description: 'Convert value to string', example: '42 | tostring => "42"' },
            { name: 'tonumber', description: 'Convert string to number', example: '"42" | tonumber => 42' },
            { name: 'tojson', description: 'Serialize value to JSON string', example: '{a:1} | tojson => "{\"a\":1}"' },
            { name: 'fromjson', description: 'Parse JSON string to value', example: '"{\"a\":1}" | fromjson => {a:1}' },
            { name: 'ascii_downcase', description: 'Convert string to lowercase', example: '"Hello" | ascii_downcase => "hello"' },
            { name: 'ascii_upcase', description: 'Convert string to uppercase', example: '"hello" | ascii_upcase => "HELLO"' },
            { name: 'objects', description: 'Select only object values', example: '.[] | objects => only objects' },
            { name: 'arrays', description: 'Select only array values', example: '.[] | arrays => only arrays' },
            { name: 'strings', description: 'Select only string values', example: '.[] | strings => only strings' },
            { name: 'numbers', description: 'Select only number values', example: '.[] | numbers => only numbers' },
            { name: 'booleans', description: 'Select only boolean values', example: '.[] | booleans => only bools' },
            { name: 'nulls', description: 'Select only null values', example: '.[] | nulls => only nulls' },
        ]
    },
    {
        category: 'String Functions',
        items: [
            { name: 'length', description: 'String length (also works on arrays/objects)', example: '"hello" | length => 5' },
            { name: 'split(str)', description: 'Split string by separator', example: '"a,b" | split(",") => ["a","b"]' },
            { name: 'join(str)', description: 'Join array elements with separator', example: '["a","b"] | join(",") => "a,b"' },
            { name: 'startswith(str)', description: 'Check if string starts with prefix', example: '"hello" | startswith("he") => true' },
            { name: 'endswith(str)', description: 'Check if string ends with suffix', example: '"hello" | endswith("lo") => true' },
            { name: 'ltrimstr(str)', description: 'Remove prefix from string', example: '"hello" | ltrimstr("he") => "llo"' },
            { name: 'rtrimstr(str)', description: 'Remove suffix from string', example: '"hello.json" | rtrimstr(".json") => "hello"' },
            { name: 'test(regex)', description: 'Test if string matches regex', example: '"foo123" | test("[0-9]+") => true' },
            { name: 'match(regex)', description: 'Get regex match details', example: '"foo123" | match("[0-9]+") => {offset:3,...}' },
            { name: 'capture(regex)', description: 'Capture named regex groups', example: 'capture("(?<a>.)(?<b>.)") => {a:..,b:..}' },
            { name: 'scan(regex)', description: 'Find all regex matches', example: '"ab12cd34" | scan("[0-9]+") => ["12","34"]' },
            { name: 'sub(regex; rep)', description: 'Replace first regex match', example: '"hello" | sub("l";"L") => "heLlo"' },
            { name: 'gsub(regex; rep)', description: 'Replace all regex matches', example: '"hello" | gsub("l";"L") => "heLLo"' },
            { name: 'explode', description: 'String to array of codepoints', example: '"ab" | explode => [97,98]' },
            { name: 'implode', description: 'Array of codepoints to string', example: '[97,98] | implode => "ab"' },
        ]
    },
    {
        category: 'Array Functions',
        items: [
            { name: 'length', description: 'Array length', example: '[1,2,3] | length => 3' },
            { name: 'map(f)', description: 'Apply filter to each element', example: '[1,2,3] | map(. * 2) => [2,4,6]' },
            { name: 'select(f)', description: 'Keep elements where filter is truthy', example: '[1,2,3] | map(select(. > 1)) => [2,3]' },
            { name: 'sort', description: 'Sort array', example: '[3,1,2] | sort => [1,2,3]' },
            { name: 'sort_by(f)', description: 'Sort by expression result', example: 'sort_by(.age) => sorted by age' },
            { name: 'group_by(f)', description: 'Group elements by expression', example: 'group_by(.type) => grouped arrays' },
            { name: 'unique', description: 'Remove duplicate elements', example: '[1,2,1] | unique => [1,2]' },
            { name: 'unique_by(f)', description: 'Remove duplicates by expression', example: 'unique_by(.id) => unique by id' },
            { name: 'reverse', description: 'Reverse array order', example: '[1,2,3] | reverse => [3,2,1]' },
            { name: 'flatten', description: 'Flatten nested arrays', example: '[[1],[2,[3]]] | flatten => [1,2,3]' },
            { name: 'add', description: 'Sum numbers or concatenate arrays/strings', example: '[1,2,3] | add => 6' },
            { name: 'any(f)', description: 'True if any element satisfies filter', example: '[1,2,3] | any(. > 2) => true' },
            { name: 'all(f)', description: 'True if all elements satisfy filter', example: '[1,2,3] | all(. > 0) => true' },
            { name: 'first', description: 'Get first element', example: '[1,2,3] | first => 1' },
            { name: 'last', description: 'Get last element', example: '[1,2,3] | last => 3' },
            { name: 'range(n)', description: 'Generate numbers 0 to n-1', example: '[range(3)] => [0,1,2]' },
            { name: 'limit(n; f)', description: 'Take first n results from filter', example: 'limit(2; .[] ) => first 2' },
            { name: 'contains(b)', description: 'Check if array contains all elements of b', example: '[1,2,3] | contains([2]) => true' },
            { name: 'inside(b)', description: 'Check if value is contained in b', example: '[2] | inside([1,2,3]) => true' },
            { name: 'indices(val)', description: 'Find all indices of value', example: '[1,2,1] | indices(1) => [0,2]' },
            { name: 'index(val)', description: 'Find first index of value', example: '[1,2,3] | index(2) => 1' },
            { name: 'transpose', description: 'Transpose array of arrays', example: '[[1,2],[3,4]] | transpose => [[1,3],[2,4]]' },
            { name: 'min', description: 'Minimum value', example: '[3,1,2] | min => 1' },
            { name: 'max', description: 'Maximum value', example: '[3,1,2] | max => 3' },
        ]
    },
    {
        category: 'Object Functions',
        items: [
            { name: 'keys', description: 'Get sorted array of keys', example: '{b:2,a:1} | keys => ["a","b"]' },
            { name: 'keys_unsorted', description: 'Get keys in original order', example: '{b:2,a:1} | keys_unsorted => ["b","a"]' },
            { name: 'values', description: 'Get array of values', example: '{a:1,b:2} | values => [1,2]' },
            { name: 'has(key)', description: 'Check if key exists', example: '{a:1} | has("a") => true' },
            { name: 'in(obj)', description: 'Check if key exists in object', example: '"a" | in({a:1}) => true' },
            { name: 'to_entries', description: 'Convert to [{key,value}] array', example: '{a:1} | to_entries => [{key:"a",value:1}]' },
            { name: 'from_entries', description: 'Convert [{key,value}] to object', example: '[{key:"a",value:1}] | from_entries => {a:1}' },
            { name: 'with_entries(f)', description: 'Transform each {key,value} entry', example: 'with_entries(.value += 1) => increment all' },
            { name: 'del(.key)', description: 'Delete a key from object', example: '{a:1,b:2} | del(.a) => {b:2}' },
            { name: 'map_values(f)', description: 'Apply filter to each value', example: '{a:1,b:2} | map_values(. + 1) => {a:2,b:3}' },
        ]
    },
    {
        category: 'Conditionals & Logic',
        items: [
            { name: 'if-then-else', description: 'Conditional expression', example: 'if . > 0 then "pos" else "neg" end' },
            { name: 'if-then-elif-else', description: 'Multiple conditions', example: 'if . > 0 then "pos" elif . == 0 then "zero" else "neg" end' },
            { name: 'and', description: 'Logical AND', example: 'true and false => false' },
            { name: 'or', description: 'Logical OR', example: 'true or false => true' },
            { name: 'not', description: 'Logical NOT', example: 'true | not => false' },
            { name: '//', description: 'Alternative operator (default value)', example: '.missing // "default" => "default"' },
            { name: 'try-catch', description: 'Error handling', example: 'try .a catch "error" => handle errors' },
            { name: '?', description: 'Suppress errors (try shorthand)', example: '.a? => null if missing' },
        ]
    },
    {
        category: 'Reduce & Recursion',
        items: [
            { name: 'reduce', description: 'Reduce array to single value', example: 'reduce .[] as $x (0; . + $x) => sum' },
            { name: 'foreach', description: 'Produce intermediate reduce values', example: 'foreach .[] as $x (0; . + $x) => running sum' },
            { name: 'recurse', description: 'Recursively descend into values', example: '{"a":{"b":1}} | recurse => all nested values' },
            { name: 'recurse(f)', description: 'Recursively apply filter', example: 'recurse(.children[]?) => tree walk' },
            { name: 'walk(f)', description: 'Apply filter to all values recursively', example: 'walk(if type=="number" then .+1 else . end)' },
            { name: 'until(cond; update)', description: 'Loop until condition met', example: '1 | until(. > 100; . * 2) => 128' },
            { name: 'while(cond; update)', description: 'Loop while condition holds', example: '1 | [.,1] | while(.[0] < 100; ...)' },
            { name: 'repeat(f)', description: 'Repeat filter indefinitely', example: '1 | repeat(. * 2) | ... (use with limit)' },
            { name: 'label-break', description: 'Break out of nested operations', example: 'label $out | foreach ...' },
        ]
    },
    {
        category: 'Path Functions',
        items: [
            { name: 'path(f)', description: 'Get path to matching values', example: 'path(.a.b) => ["a","b"]' },
            { name: 'paths', description: 'Get all paths in value', example: '{a:{b:1}} | [paths] => [["a"],["a","b"]]' },
            { name: 'leaf_paths', description: 'Get paths to leaf values only', example: '{a:{b:1}} | [leaf_paths] => [["a","b"]]' },
            { name: 'getpath(p)', description: 'Get value at path', example: '{a:{b:1}} | getpath(["a","b"]) => 1' },
            { name: 'setpath(p; v)', description: 'Set value at path', example: '{} | setpath(["a"]; 1) => {a:1}' },
            { name: 'delpaths(ps)', description: 'Delete values at multiple paths', example: 'delpaths([["a"]]) => remove .a' },
        ]
    },
    {
        category: 'Format Strings',
        items: [
            { name: '@csv', description: 'Format array as CSV row', example: '["a","b"] | @csv => "\\"a\\",\\"b\\""' },
            { name: '@tsv', description: 'Format array as TSV row', example: '["a","b"] | @tsv => "a\\tb"' },
            { name: '@json', description: 'Format as JSON string', example: '{a:1} | @json => "{\"a\":1}"' },
            { name: '@html', description: 'HTML-escape string', example: '"<b>" | @html => "&lt;b&gt;"' },
            { name: '@uri', description: 'URI-encode string', example: '"a b" | @uri => "a%20b"' },
            { name: '@base64', description: 'Base64 encode', example: '"hello" | @base64 => "aGVsbG8="' },
            { name: '@base64d', description: 'Base64 decode', example: '"aGVsbG8=" | @base64d => "hello"' },
        ]
    },
    {
        category: 'Advanced Patterns',
        items: [
            { name: 'def name: body;', description: 'Define a reusable function', example: 'def double: . * 2; [1,2] | map(double)' },
            { name: 'def name(arg): body;', description: 'Define function with argument', example: 'def addN(n): . + n; 5 | addN(3)' },
            { name: '$var', description: 'Variable binding with as', example: '.x as $x | .y + $x' },
            { name: 'as patterns', description: 'Destructuring assignment', example: '. as {a: $a, b: $b} | $a + $b' },
            { name: '?//', description: 'Destructuring alternative', example: '.a ?// .b ?// "default"' },
            { name: 'env', description: 'Access environment variables', example: 'env.HOME => "/home/user"' },
            { name: 'input', description: 'Read next JSON input', example: 'input => next input value' },
            { name: 'debug', description: 'Print value to stderr and pass through', example: '.x | debug | .y' },
        ]
    }
];
