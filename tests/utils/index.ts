import { format, Options } from 'prettier';
import tsParser from 'prettier/parser-typescript';

const prettierOptions: Options = {
    parser: 'typescript',
    plugins: [tsParser]
};

export function prettierEqTo(val: string, to: string) {
    expect(format(val, prettierOptions).trim()).toBe(
        format(to, prettierOptions).trim()
    );
}
