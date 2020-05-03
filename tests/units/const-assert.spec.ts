import { TypeScriptVersion, upgrade } from '../../src';
import { prettierEqTo } from '../utils';

describe('const assert', () => {
    const version = TypeScriptVersion.v3_4;

    it('should work with boolean literal(true)', () => {
        const code = `true as true`;
        const after = `true as const`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with boolean literal(false)', () => {
        const code = `false as false`;
        const after = `false as const`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with string literal', () => {
        const code = `"foo" as "foo"`;
        const after = `"foo" as const`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with paren', () => {
        const code = `(-1) as -1`;
        const after = `(-1) as const`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with object literal', () => {
        const code = `({ a: "123" } as { a: "123" })`;
        const after = `({ a: "123" } as const)`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with array literal', () => {
        const code = `([1, 2, 3] as [1, 2, 3])`;
        const after = `([1, 2, 3] as const)`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with enum member', () => {
        const code = `enum A { f }\n A.f as A.f`;
        const after = `enum A { f }\n A.f as const`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with complex enum', () => {
        const code = `enum A { f = "f", ff = -1 }\n A.ff as A.ff`;
        const after = `enum A { f = "f", ff = -1 }\n A.ff as const`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with complex string enum', () => {
        const code = `enum A { f = "f", ff = "f" + "f" }\n A.ff as A.ff`;
        const after = `enum A { f = "f", ff = "f" + "f" }\n A.ff as const`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should not work with numeric tuple', () => {
        const code = `([1, 2, 3] as [number, number, number])`;
        const after = `([1, 2, 3] as [number, number, number])`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should not work with numeric array', () => {
        const code = `([1, 2, 3] as number[])`;
        const after = `([1, 2, 3] as number[])`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with two spans', () => {
        const code = `call([1, 2, 3] as [1, 2, 3], [4, 5] as [4, 5])`;
        const after = `call([1, 2, 3] as const, [4, 5] as const)`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should not work with variable', () => {
        const code = `a as true`;
        prettierEqTo(upgrade(code, version), code);
    });
});
