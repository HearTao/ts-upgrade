import { TypeScriptVersion, upgrade } from '../../src';

describe('nullish upgrade', () => {
    const version = TypeScriptVersion.v3_7;

    it('should work with equal to null', () => {
        const code = `a == null ? 1 : a`;
        const after = `a ?? 1`;
        expect(upgrade(code, version)).toBe(after);
    });

    it('should work with parens', () => {
        const code = `(a) == null ? 1 : a`;
        const after = `a ?? 1`;
        expect(upgrade(code, version)).toBe(after);
    })

    it('should work with strict equal to null', () => {
        const code = `a === null ? 1 : a`;
        const after = `a ?? 1`;
        expect(upgrade(code, version)).toBe(after);
    });

    it('should work with strict equal to undefined', () => {
        const code = `a === undefined ? 1 : a`;
        const after = `a ?? 1`;
        expect(upgrade(code, version)).toBe(after);
    });

    it('should work with strict equal to void expression', () => {
        const code = `a === void 1 ? 1 : a`;
        const after = `a ?? 1`;
        expect(upgrade(code, version)).toBe(after);
    });

    it('should work with binary strict equal', () => {
        const code = `a === null || a === undefined ? 1 : a`;
        const after = `a ?? 1`;
        expect(upgrade(code, version)).toBe(after);
    });

    it('should work with call expression', () => {
        const code = `a() === undefined ? 1 : a()`;
        const after = `a() ?? 1`;
        expect(upgrade(code, version)).toBe(after);
    });

    it('should work with property access expression', () => {
        const code = `a.b.c === undefined ? 1 : a.b.c`;
        const after = `a.b.c ?? 1`;
        expect(upgrade(code, version)).toBe(after);
    });
});
