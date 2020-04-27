import { Expression, isParenthesizedExpression } from 'typescript';

export function skipParens(node: Expression) {
    while (isParenthesizedExpression(node)) {
        node = node.expression;
    }
    return node;
}
