import { TypeScriptVersion, upgrade } from '../../src';
import { format, Options } from 'prettier';
import tsParser from 'prettier/parser-typescript';

describe('const assert', () => {
    const version = TypeScriptVersion.v3_4;
    const prettierOptions: Options = {
        parser: 'typescript',
        plugins: [tsParser]
    };

    it('should work with boolean literal(true)', () => {
        const code = `true as true`;
        const after = `true as const;`;
        expect(upgrade(code, version).trim()).toBe(after);
    });

    it('should work with boolean literal(false)', () => {
        const code = `false as false`;
        const after = `false as const;`;
        expect(upgrade(code, version).trim()).toBe(after);
    });

    it('should work with string literal', () => {
        const code = `"foo" as "foo"`;
        const after = `"foo" as const;`;
        expect(upgrade(code, version).trim()).toBe(after);
    });

    it('should work with object literal', () => {
        const code = `({ a: "123" } as { a: "123" })`;
        const after = `({ a: "123" } as const);`;
        expect(upgrade(code, version).trim()).toBe(after);
    });

    it('should work with tuple', () => {
        const code = `([1, 2, 3] as [number, number, number])`;
        const after = `([1, 2, 3] as const);`;
        expect(upgrade(code, version).trim()).toBe(after);
    });

    it('should work with array literal', () => {
        const code = `([1, 2, 3] as [1, 2, 3])`;
        const after = `([1, 2, 3] as const);`;
        expect(upgrade(code, version).trim()).toBe(after);
    });

    it('should work with enum member', () => {
        const code = `enum A { f }\n A.f as A.f;`;
        const after = format(
            `enum A { f }\n A.f as const;`,
            prettierOptions
        ).trim();
        expect(format(upgrade(code, version), prettierOptions).trim()).toBe(
            after
        );
    });
});
