import {
    BinaryExpression,
    BinaryOperator,
    CallExpression,
    ConditionalExpression,
    createCallChain,
    createElementAccessChain,
    createNullishCoalesce,
    createPrinter,
    createPropertyAccessChain,
    createSourceFile,
    createToken,
    ElementAccessExpression,
    EmitHint,
    Expression,
    forEachChild,
    isBinaryExpression,
    isCallExpression,
    isElementAccessExpression,
    isIdentifier,
    isPrivateIdentifier,
    isPropertyAccessExpression,
    isVoidExpression,
    Node,
    PropertyAccessExpression,
    ScriptTarget,
    SyntaxKind,
    Token
} from 'typescript';
import { TypeScriptVersion } from './types';
import { skipParens } from './utils';

export function upgrade(code: string, target: TypeScriptVersion) {
    const sourceFile = createSourceFile('', code, ScriptTarget.Latest);

    const printer = createPrinter();
    const afterConvert = forEachChild(sourceFile, visitor);
    if (!afterConvert) {
        return 'empty node';
    }
    return printer.printNode(EmitHint.Unspecified, afterConvert, sourceFile);

    function visitor(node: Node): Node | undefined {
        switch (node.kind) {
            case SyntaxKind.ConditionalExpression:
                return upgradeConditionalExpression(
                    node as ConditionalExpression
                );
            case SyntaxKind.BinaryExpression:
                return upgradeBinaryExpression(node as BinaryExpression);
            default:
                return forEachChild(node, visitor);
        }
    }

    function upgradeConditionalExpression(expr: ConditionalExpression): Node {
        if (target >= TypeScriptVersion.v3_7) {
            // a === null || a === undefined ? b : a
            // to
            // a ?? b
            const nullableConditionTarget = getNullableConditionTarget(expr);
            if (
                nullableConditionTarget &&
                couldConvertIntoNullish(expr, nullableConditionTarget)
            ) {
                return createNullishCoalesce(
                    nullableConditionTarget,
                    expr.whenTrue
                );
            }
        }
        return expr;
    }

    function upgradeBinaryExpression(
        expr: BinaryExpression
    ): Expression | undefined {
        // a && a.b && a.b["c"] && a.b["c"]()
        // to
        // a?.b?.["c"]?.()
        const optionalChains = getOptionalChains(expr);
        if (optionalChains) {
            return createOptionalChains(optionalChains);
        }
        return expr;
    }

    function cast<T extends Node, U extends T>(
        node: T,
        cb: (v: T) => v is U
    ): U {
        if (!cb(node)) {
            throw new Error('invalid cast: ' + SyntaxKind[node.kind]);
        }
        return node;
    }

    function createOptionalChains(
        chains: ChainableExpression[]
    ): ChainableExpression {
        const fistChain = chains[0];
        let lastChain = createOptionalChainByChainableExpression(
            fistChain,
            fistChain.expression
        );
        for (let i = 1; i < chains.length; ++i) {
            const chain = chains[i];
            lastChain = createOptionalChainByChainableExpression(
                chain,
                lastChain
            );
        }
        return lastChain;
    }

    function createOptionalChainByChainableExpression(
        expr: ChainableExpression,
        left: Expression
    ) {
        switch (expr.kind) {
            case SyntaxKind.PropertyAccessExpression:
                return createPropertyAccessChain(
                    left,
                    createToken(SyntaxKind.QuestionDotToken),
                    cast(expr.name, isIdentifier)
                );
            case SyntaxKind.ElementAccessExpression:
                return createElementAccessChain(
                    left,
                    createToken(SyntaxKind.QuestionDotToken),
                    expr.argumentExpression
                );
            case SyntaxKind.CallExpression:
                const call = expr as CallExpression;
                return createCallChain(
                    left,
                    createToken(SyntaxKind.QuestionDotToken),
                    call.typeArguments,
                    call.arguments
                );
        }
    }

    type ChainableExpression =
        | PropertyAccessExpression
        | ElementAccessExpression
        | CallExpression;

    function isChainableExpression(
        expr: Expression
    ): expr is ChainableExpression {
        return (
            isPropertyAccessExpression(expr) ||
            isElementAccessExpression(expr) ||
            isCallExpression(expr)
        );
    }

    // a && a.b && a.b.c
    function getOptionalChains(expr: BinaryExpression) {
        const chains: ChainableExpression[] = [];
        let expression: Expression = expr;
        while (
            isBinaryExpression(expression) &&
            expression.operatorToken.kind === SyntaxKind.AmpersandAmpersandToken
        ) {
            if (!isChainableExpression(expression.right)) {
                return undefined;
            }

            chains.unshift(expression.right);
            expression = expression.left;
        }

        if (chains.length < 1) return undefined;

        let prefix: ChainableExpression = chains[0];
        for (let i = 1; i < chains.length; ++i) {
            const chain = chains[i];
            if (!isEqualityExpression(prefix, chain.expression)) {
                return undefined;
            }
            if (
                isPropertyAccessExpression(chain) &&
                isPrivateIdentifier(chain.name)
            ) {
                return undefined;
            }
            prefix = chain;
        }

        return chains;
    }

    function couldConvertIntoNullish(
        cond: ConditionalExpression,
        nullableConditionTarget: Expression
    ): boolean {
        const left = skipParens(cond.whenFalse);
        const right = skipParens(nullableConditionTarget);

        return isEqualityExpression(left, right);
    }

    function isEqualityExpression(left: Expression, right: Expression) {
        if (left.kind !== right.kind) return false;

        if (
            isIdentifier(left) &&
            isIdentifier(right) &&
            left.text === right.text
        ) {
            return true;
        }

        if (
            left.getText(sourceFile).trim() === right.getText(sourceFile).trim()
        ) {
            return true;
        }
        return false;
    }

    function getNullableConditionTarget(
        expr: ConditionalExpression
    ): Expression | undefined {
        const condition = skipParens(expr.condition);

        let target: Expression | undefined;
        if (isBinaryExpression(condition)) {
            if ((target = isNullableEqualityExpression(condition))) {
                return target;
            }
            if ((target = isBinaryNullableEqualityExpression(condition))) {
                return target;
            }
        }
        return condition;
    }

    function binaryCompare(
        cb: (
            left: Expression,
            operator: Token<BinaryOperator>,
            right: Expression
        ) => Expression | undefined,
        left: Expression,
        operator: Token<BinaryOperator>,
        right: Expression
    ) {
        return cb(left, operator, right) || cb(right, operator, left);
    }

    function isNullableEqualityExpression(expr: BinaryExpression) {
        return (
            isEqualityToNull(expr) ||
            isStrictEqualityToNull(expr) ||
            isStrictEqualityToUndefined(expr) ||
            isStrictEqualityToVoidExpression(expr)
        );
    }

    function isEqualityToNull(expr: BinaryExpression) {
        const left = skipParens(expr.left);
        const right = skipParens(expr.right);
        return binaryCompare(
            doEqualityToNullCompare,
            left,
            expr.operatorToken,
            right
        );
    }

    // expr == null
    // return expr
    function doEqualityToNullCompare(
        left: Expression,
        operator: Token<BinaryOperator>,
        right: Expression
    ) {
        return operator.kind === SyntaxKind.EqualsEqualsToken &&
            right.kind === SyntaxKind.NullKeyword
            ? left
            : undefined;
    }

    function isStrictEqualityToUndefined(expr: BinaryExpression) {
        const left = skipParens(expr.left);
        const right = skipParens(expr.right);
        return binaryCompare(
            doStrictEqualityToUndefinedCompare,
            left,
            expr.operatorToken,
            right
        );
    }

    // expr === undefined
    // return expr
    function doStrictEqualityToUndefinedCompare(
        left: Expression,
        operator: Token<BinaryOperator>,
        right: Expression
    ) {
        return operator.kind === SyntaxKind.EqualsEqualsEqualsToken &&
            (right.kind === SyntaxKind.UndefinedKeyword ||
                (isIdentifier(right) && right.text === 'undefined'))
            ? left
            : undefined;
    }

    function isStrictEqualityToNull(expr: BinaryExpression) {
        const left = skipParens(expr.left);
        const right = skipParens(expr.right);
        return binaryCompare(
            doStrictEqualityToNullCompare,
            left,
            expr.operatorToken,
            right
        );
    }

    // expr === null
    // return expr
    function doStrictEqualityToNullCompare(
        left: Expression,
        operator: Token<BinaryOperator>,
        right: Expression
    ) {
        return operator.kind === SyntaxKind.EqualsEqualsEqualsToken &&
            right.kind === SyntaxKind.NullKeyword
            ? left
            : undefined;
    }

    function isStrictEqualityToVoidExpression(expr: BinaryExpression) {
        const left = skipParens(expr.left);
        const right = skipParens(expr.right);
        return binaryCompare(
            doStrictEqualityToVoidExpressionCompare,
            left,
            expr.operatorToken,
            right
        );
    }

    // expr === void *
    // return expr
    function doStrictEqualityToVoidExpressionCompare(
        left: Expression,
        operator: Token<BinaryOperator>,
        right: Expression
    ) {
        return operator.kind === SyntaxKind.EqualsEqualsEqualsToken &&
            isVoidExpression(right)
            ? left
            : undefined;
    }

    // expr === null || expr == undefined
    // return expr
    function isBinaryNullableEqualityExpression(expr: BinaryExpression) {
        if (expr.operatorToken.kind !== SyntaxKind.BarBarToken)
            return undefined;
        if (!isBinaryExpression(expr.left) || !isBinaryExpression(expr.right))
            return undefined;
        const left = isNullableEqualityExpression(expr.left);
        const right = isNullableEqualityExpression(expr.right);
        return left && right && isEqualityExpression(left, right)
            ? left
            : undefined;
    }
}
