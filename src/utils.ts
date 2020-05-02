import {
    Expression,
    isParenthesizedExpression,
    Node,
    SyntaxKind
} from 'typescript';

export function skipParens(node: Expression) {
    while (isParenthesizedExpression(node)) {
        node = node.expression;
    }
    return node;
}

export function isDef<T>(v: T | null | undefined): v is T {
    return v !== null && v !== undefined;
}

export function assertDef<T>(v: T | null | undefined): T {
    if (isDef(v)) {
        return v;
    }
    throw new Error('invalid assert def');
}

export function cast<T extends Node, U extends T>(
    node: T,
    cb: (v: T) => v is U
): U {
    if (!cb(node)) {
        throw new Error('invalid cast: ' + SyntaxKind[node.kind]);
    }
    return node;
}

export function lastOrUndefined<T>(
    list: readonly T[] | undefined
): T | undefined {
    if (!list || !list.length) {
        return undefined;
    }
    return list[list.length - 1];
}

export function last<T>(list: readonly T[] | undefined): T {
    const result = lastOrUndefined(list);
    if (!result) {
        throw new Error('index out of range: last');
    }
    return result;
}
