import { TypeScriptVersion, upgrade } from '../../src';
import { prettierEqTo } from '../utils';

describe('export * as ns ugrade', () => {
    const version = TypeScriptVersion.V3_8;

    it('should work with simple case', () => {
        const code = `import * as A from "./a.js";\nexport { A };`;
        const after = `export * as A from "./a.js";`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with default import', () => {
        const code = `import A, * as B from './a.js';\nexport { B };`;
        const after = `import A from './a.js';\nexport * as B from './a.js';`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with multiple named exports', () => {
        const code = `import * as A from './a.js';\n export { A, B as C, D };`;
        const after = `export * as A from './a.js';\nexport { B as C, D };`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with property exports', () => {
        const code = `import * as A from './a.js';\nexport { A as B };`;
        const after = `export * as B from './a.js';`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with multiple case', () => {
        const code = `import * as A from './a.js';\nimport * as B from './b.js';\nexport {A, B};`;
        const after = `export * as A from './a.js';\nexport * as B from './b.js';`;
        prettierEqTo(upgrade(code, version), after);
    });
});
