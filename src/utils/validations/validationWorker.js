self.onmessage = async (e) => {
    const { field, value, code } = e.data;
    
    let result = {
        field: field,
        valid: false,
        message: 'Validation failed',
    };

    try {
        if (!code || code.trim() === '') {
            throw new Error('Validation code is empty');
        }

        const forbiddenPatterns = [
            { name: 'eval', re: /\beval\s*\(/i },
            { name: 'Function constructor', re: /new\s+Function\s*\(/i },
            { name: 'Function(...) call', re: /\bFunction\s*\(/i },
            { name: 'import', re: /\bimport\b/i },
            { name: 'require', re: /\brequire\s*\(/i },
            { name: 'importScripts', re: /\bimportScripts\s*\(/i },
            { name: 'fetch', re: /\bfetch\s*\(/i },
            { name: 'XMLHttpRequest', re: /XMLHttpRequest/i },
            { name: 'WebSocket', re: /\bWebSocket\b/i },
            { name: 'window/document', re: /\b(window|document)\b/i },
            { name: 'localStorage/sessionStorage/indexedDB', re: /\b(localStorage|sessionStorage|indexedDB)\b/i },
            { name: 'process/child_process', re: /\b(process|child_process)\b/i },
            { name: 'WebAssembly', re: /\bWebAssembly\b/i },
            { name: 'Deno', re: /\bDeno\b/i },
            { name: 'infinite loop (while true)', re: /while\s*\(\s*true\s*\)/i },
            { name: 'infinite loop (for ;;)', re: /for\s*\(\s*;\s*;\s*\)/i }
        ];

        const matches = forbiddenPatterns.filter(p => p.re.test(code));
        if (matches.length > 0) {
            const names = matches.map(m => m.name).join(', ');
            throw new Error(`Validation code uses forbidden or unsafe features: ${names}`);
        }

        if (code.length > 20000) {
            throw new Error('Validation code is too large');
        }

        // ✅ Wrap code with dynamically created variable name
        const safeFieldName = field.replace(/[^a-zA-Z0-9_]/g, '_'); // ensure it's valid JS variable
        const wrappedCode = `
            "use strict";
            const ${safeFieldName} = ${JSON.stringify(value)};
            ${code}
        `;

        // Create wrapper function to execute user code
        const validationFn = new Function(wrappedCode);

        // Execute validation function
        let validationResult = validationFn();

        // Handle async validation
        if (validationResult instanceof Promise) {
            validationResult = await validationResult;
        }

        if (!validationResult) {
            throw new Error('Validation code did not return a result. Make sure your code has a return statement.');
        }

        if (typeof validationResult !== 'object') {
            throw new Error(`Validation must return an object, but got ${typeof validationResult}`);
        }

        if (!('valid' in validationResult)) {
            throw new Error('Validation result must have a "valid" property');
        }

        if (typeof validationResult.valid !== 'boolean') {
            throw new Error(`"valid" must be a boolean, but got ${typeof validationResult.valid}`);
        }

        result = {
            field: field,
            valid: validationResult.valid,
            message: validationResult.message || '',
        };

    } catch (err) {
        result = {
            field: field,
            valid: false,
            message: `Validation error: ${err.message}`,
        };
    }

    self.postMessage(result);
};
