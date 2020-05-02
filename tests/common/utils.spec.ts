import {
    createIdentifier,
    createLiteral,
    isIdentifier,
    Expression
} from 'typescript';
import { assertDef, cast, lastOrUndefined, last } from '../../src/utils';

describe('Common tools', () => {
    it('should work with assertDef', () => {
        let v1: string | undefined = '';
        let v2: string | undefined = undefined;
        expect(() => assertDef(v1)).not.toThrowError();
        expect(() => assertDef(v2)).toThrowError();
    });

    it('should work with cast', () => {
        const e1: Expression = createIdentifier('foo');
        const e2: Expression = createLiteral(1);

        expect(() => cast(e1, isIdentifier)).not.toThrowError();
        expect(() => cast(e2, isIdentifier)).toThrowError();
    });

    it('should work with lastOrUndefined', () => {
        const arr1: number[] = [1, 2, 3];
        const arr2: number[] = [];
        expect(lastOrUndefined(arr1)).toBe(3);
        expect(lastOrUndefined(arr2)).toBeUndefined();
    });

    it('should work with last', () => {
        const arr1: number[] = [1, 2, 3];
        const arr2: number[] = [];
        expect(last(arr1)).toBe(3);
        expect(() => {
            last(arr2);
        }).toThrowError();
    });
});
