import { TypeScriptVersion, upgrade } from '../src';

function main() {
    const codeToConvert = [
        'a == null ? a : 1',
        'a === null ? a : 1',
        'a === undefined ? a : 1',
        'a === void 0 ? a : 1',
        'a === null || a === undefined ? a : 1',
        'a() == null ? a() : 1',
        'a && a.b && a.b.c',
        "a && a.b && a.b['c'] && a.b['c']() && a.b['c']().d"
    ];
    const convertedCode = codeToConvert.map((code) =>
        upgrade(code, TypeScriptVersion.v3_7)
    );
    console.log(codeToConvert);
    console.log(convertedCode);
}

main();
