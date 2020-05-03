import { TypeScriptVersion, upgrade } from '../../src';
import { prettierEqTo } from '../utils';

describe('nullish upgrade', () => {
    const version = TypeScriptVersion.v3_7;

    it('should work with equal to null', () => {
        const code = `a == null ? 1 : a`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should only work on part of expression', () => {
        const code = `foo ? a == null ? 1 : a : 2`;
        const after = `foo ? a ?? 1 : 2`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with logical expression', () => {
        const code = `(a || b) !== null ? (a || b) : 2`;
        const after = `(a || b) ?? 2`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with parens', () => {
        const code = `(a) == null ? 1 : a`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with strict equal to null', () => {
        const code = `a === null ? 1 : a`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with strict equal to undefined', () => {
        const code = `a === undefined ? 1 : a`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with strict equal to void expression', () => {
        const code = `a === void 1 ? 1 : a`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with binary strict equal', () => {
        const code = `a === null || a === undefined ? 1 : a`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with not equal to null', () => {
        const code = `a != null ? a : 1`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with strict not equal to null', () => {
        const code = `a !== null ? a : 1`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with strict not equal to undefined', () => {
        const code = `a !== undefined ? a : 1`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with strict not equal to void expression', () => {
        const code = `a !== void 1 ? a : 1`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with binary strict equal', () => {
        const code = `a !== null && a !== undefined ? a : 1`;
        const after = `a ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with call expression', () => {
        const code = `a() === undefined ? 1 : a()`;
        const after = `a() ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with property access expression', () => {
        const code = `a.b.c === undefined ? 1 : a.b.c`;
        const after = `a.b.c ?? 1`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with recursion', () => {
        const code = `a(foo !== null ? foo : 1) !== undefined ? a(foo !== null ? foo : 1) : (b !== null ? b : 2)`;
        const after = `a(foo ?? 1) ?? (b ?? 2)`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should not work with binary and', () => {
        const code = `a & 1 ? 1 : 0`;
        prettierEqTo(upgrade(code, version), code);
    });

    it('should not work with wrong branch', () => {
        const code = `a == null ? a : 1`;
        prettierEqTo(upgrade(code, version), code);
    });

    it('should not work with wrong and condition', () => {
        const code = `a !== null && b !== undefined ? a : 1`; 
        prettierEqTo(upgrade(code, version), code);
    })
 
});
