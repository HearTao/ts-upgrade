import { TypeScriptVersion, upgrade } from '../../src';
import { prettierEqTo } from '../utils';

describe('export * as ns ugrade', () => {
    const version = TypeScriptVersion.v3_8;

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

    it('should work with extra local symbols', () => {
        const code = `import * as A from './a.js';\nconst var1 = 1;\nfunction fn1() {}\nexport { A };`;
        const after = `const var1 = 1;\n function fn1() {}\nexport * as A from './a.js';`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with multiple case', () => {
        const code = `import * as A from './a.js';\nimport * as B from './b.js';\nexport {A, B};`;
        const after = `export * as A from './a.js';\nexport * as B from './b.js';`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with one import and many exports', () => {
        const code = `import * as A from './a.js';\nexport {A, A as B};`;
        const after = `export * as A from './a.js';\nexport * as B from './a.js';`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with one import and many exports seperately', () => {
        const code = `import * as A from './a.js';\nexport { A };\nexport {A as B};`;
        const after = `export * as A from './a.js';\nexport * as B from './a.js';`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should not work with used symbol', () => {
        const code = `import * as A from './a.js';\nimport * as C from './c.js';\nconst B = 1;\nconsole.log(A);\nexport { A, B, C as D};`;
        const after = `import * as A from './a.js';\nconst B = 1;\nconsole.log(A);\nexport * as D from './c.js';\nexport { A, B };`;
        prettierEqTo(upgrade(code, version), after);
    });
    it('should not work with other import', () => {
        const code = `import * as A from './a.js';\nimport B from './b.js';\nexport {A, B};`;
        const after = `import B from './b.js';\nexport * as A from './a.js';\nexport { B };`;
        prettierEqTo(upgrade(code, version), after);
    });

});
