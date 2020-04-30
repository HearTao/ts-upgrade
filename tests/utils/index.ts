import { format, Options } from 'prettier';
import tsParser from 'prettier/parser-typescript';

const prettierOptions: Options = {
    parser: 'typescript',
    plugins: [tsParser]
};

export function prettierEqTo(val: string, to: string) {
    expect(
        format(val, prettierOptions)
            .trim()
            .replace(/\n+/gm, '\n')
            .replace(/^\n*|\n*$/gm, '')
    ).toBe(format(to, prettierOptions).trim());
}
