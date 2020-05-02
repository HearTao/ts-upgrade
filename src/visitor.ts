import {
    AsExpression,
    BinaryExpression,
    BinaryOperator,
    CallExpression,
    ConditionalExpression,
    createAsExpression,
    createCallChain,
    createElementAccessChain,
    createNullishCoalesce,
    createPropertyAccessChain,
    createToken,
    createTypeReferenceNode,
    ElementAccessExpression,
    Expression,
    forEachChild,
    isBinaryExpression,
    isCallExpression,
    isConstTypeReference,
    isElementAccessExpression,
    isIdentifier,
    isPrivateIdentifier,
    isPropertyAccessExpression,
    isVoidExpression,
    Node,
    PropertyAccessExpression,
    SourceFile,
    SyntaxKind,
    textChanges,
    Token,
    TypeChecker,
    TypeFormatFlags
} from 'typescript';
import { TypeScriptVersion } from '.';
import { deSynthesized, setParentContext } from './hack';
import { isValidConstAssertionArgument } from './internal';
import { cast, skipParens, lastOrUndefined, assertDef } from './utils';

export const visit = (
    sourceFile: SourceFile,
    checker: TypeChecker,
    changeTracker: textChanges.ChangeTracker,
    target: TypeScriptVersion
): void => {
    visitor(sourceFile);

    function visitor(node: Node): Node | undefined {
        switch (node.kind) {
            case SyntaxKind.ConditionalExpression:
                return upgradeConditionalExpression(
                    node as ConditionalExpression
                );
            case SyntaxKind.BinaryExpression:
                return upgradeBinaryExpression(node as BinaryExpression);
            case SyntaxKind.AsExpression:
                return upgradeAsExpression(node as AsExpression);
            default:
                return forEachChild(node, visitor);
        }
    }

    function upgradeAsExpression(expr: AsExpression): Node | undefined {
        if (target >= TypeScriptVersion.v3_4) {
            const expression = skipParens(expr.expression);
            if (
                !isConstTypeReference(expr.type) &&
                isValidConstAssertionArgument(expression, checker)
            ) {
                const synthesizedAssertionNode = createAsExpression(
                    expression,
                    createTypeReferenceNode('const', undefined)
                );

                const assertionNode = deSynthesized(
                    synthesizedAssertionNode,
                    sourceFile
                );
                const exprType = checker.getTypeAtLocation(expression);
                const assignable = setParentContext(
                    expression,
                    assertionNode,
                    () => {
                        const assertionType = checker.getTypeAtLocation(
                            assertionNode
                        );
                        const typeNodeType = checker.getTypeFromTypeNode(
                            expr.type
                        );
                        const textExprTypeText = checker.typeToString(
                            exprType,
                            undefined,
                            TypeFormatFlags.NoTruncation
                        );
                        const textNodeTypeText = checker.typeToString(
                            typeNodeType,
                            undefined,
                            TypeFormatFlags.NoTruncation
                        );
                        return (
                            textExprTypeText === textNodeTypeText &&
                            checker.isTypeAssignableTo(
                                typeNodeType,
                                assertionType
                            )
                        );
                    }
                );

                if (assignable) {
                    const newNode = createAsExpression(
                        expression,
                        createTypeReferenceNode('const', undefined)
                    );
                    changeTracker.replaceNode(sourceFile, expr, newNode);
                }
            }
        }
        return forEachChild(expr, visitor);
    }

    function upgradeConditionalExpression(
        expr: ConditionalExpression
    ): Node | undefined {
        if (target >= TypeScriptVersion.v3_7) {
            // a === null || a === undefined ? b : a
            // to
            // a ?? b
            let condBranch: Expression | undefined;
            const nullableConditionTarget = getNullableConditionTarget(expr);
            if (
                nullableConditionTarget &&
                (condBranch = getNullishCondBranch(
                    expr,
                    nullableConditionTarget
                ))
            ) {
                const fallbackBranch =
                    skipParens(expr.whenTrue) === condBranch
                        ? expr.whenFalse
                        : expr.whenTrue;
                const newNode = createNullishCoalesce(
                    nullableConditionTarget,
                    fallbackBranch
                );
                changeTracker.replaceNode(sourceFile, expr, newNode);
            }
        }
        return forEachChild(expr, visitor);
    }

    function upgradeBinaryExpression(expr: BinaryExpression): Node | undefined {
        // a && a.b && a.b["c"] && a.b["c"]()
        // to
        // a?.b?.["c"]?.()
        const optionalChains = getOptionalChains(expr);
        if (optionalChains) {
            createOptionalChains(
                expr,
                optionalChains.first,
                optionalChains.chains
            );
        }
        return forEachChild(expr, visitor);
    }

    function createOptionalChains(
        expr: BinaryExpression,
        firstChain: Expression,
        chains: ChainableExpression[]
    ): void {
        let prefix = firstChain;
        let lastChain = firstChain;
        for (let i = 0; i < chains.length; ++i) {
            const chain = chains[i];
            prefix = assertDef(replacePrefix(lastChain, chain, prefix));
            lastChain = chain;
        }
        changeTracker.replaceNode(sourceFile, expr, prefix);
    }

    function replacePrefix(
        expr: Expression,
        chains: ChainableExpression,
        to: Expression
    ) {
        const prefix = getPrefixIfEquality(expr, chains);
        const lastChainOptional = lastOrUndefined(prefix);
        if (!lastChainOptional) return undefined;
        const lastChain = lastChainOptional;

        const [result] = replaceWorker(chains);
        return result;

        function replaceWorker(chain: Expression): [Expression, boolean] {
            if (isEqualityExpression(chain, lastChain)) {
                return [to, false];
            }

            const chainable = cast(chain, isChainableExpression);
            const [left, isNotOptional] = replaceWorker(chainable.expression);
            return [
                createOptionalChainByChainableExpression(
                    chainable,
                    left,
                    isNotOptional
                ),
                true
            ];
        }
    }

    function createOptionalChainByChainableExpression(
        expr: ChainableExpression,
        left: Expression,
        isNotOptional?: boolean
    ) {
        const token = !isNotOptional
            ? createToken(SyntaxKind.QuestionDotToken)
            : undefined;
        switch (expr.kind) {
            case SyntaxKind.PropertyAccessExpression:
                return createPropertyAccessChain(
                    left,
                    token,
                    cast(expr.name, isIdentifier)
                );
            case SyntaxKind.ElementAccessExpression:
                return createElementAccessChain(
                    left,
                    token,
                    expr.argumentExpression
                );
            case SyntaxKind.CallExpression:
                return createCallChain(
                    left,
                    token,
                    expr.typeArguments,
                    expr.arguments
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

    interface ChainsInfo {
        first: Expression;
        chains: ChainableExpression[];
    }

    // a && a.b && a.b.c
    function getOptionalChains(expr: BinaryExpression): ChainsInfo | undefined {
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
            /* istanbul ignore if */
            if (!getPrefixIfEquality(prefix, chain.expression)) {
                return undefined;
            }
            /* istanbul ignore if */
            if (
                isPropertyAccessExpression(chain) &&
                isPrivateIdentifier(chain.name)
            ) {
                return undefined;
            }
            prefix = chain;
        }

        return {
            first: expression,
            chains
        };
    }

    function getPrefixIfEquality(
        expr1: Expression,
        expr2: Expression
    ): Expression[] | undefined {
        const sa = assignIntoQueue(expr1);
        const sb = assignIntoQueue(expr2);

        let i = 0;
        let l = Math.min(sa.length, sb.length);
        while (i < l) {
            const ea = sa[i];
            const eb = sb[i];
            /* istanbul ignore next */
            if (!isEqualityExpression(ea, eb)) {
                return undefined;
            }
            ++i;
        }

        return sa.slice(0, l);

        function assignIntoQueue(expr: Expression) {
            const result: Expression[] = [];
            while (isChainableExpression(expr)) {
                result.unshift(expr);
                expr = expr.expression;
            }
            result.unshift(expr);
            return result;
        }
    }

    function getNullishCondBranch(
        cond: ConditionalExpression,
        nullableConditionTarget: Expression
    ): Expression | undefined {
        const target = getNullishTargetBranch(cond);
        if (!target) return undefined;

        const left = skipParens(target);
        const right = skipParens(nullableConditionTarget);

        return isEqualityExpression(left, right) ? left : undefined;
    }

    function getNullishTargetBranch(cond: ConditionalExpression) {
        if (isBinaryExpression(cond.condition)) {
            switch (cond.condition.operatorToken.kind) {
                case SyntaxKind.EqualsEqualsToken:
                case SyntaxKind.EqualsEqualsEqualsToken:
                case SyntaxKind.BarBarToken:
                    return cond.whenFalse;
                case SyntaxKind.ExclamationEqualsToken:
                case SyntaxKind.ExclamationEqualsEqualsToken:
                case SyntaxKind.AmpersandAmpersandToken:
                    return cond.whenTrue;
                /* istanbul ignore next */
                default:
                    return undefined;
            }
        }
        return undefined;
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
            if ((target = isBinaryNullableEqualityOrNotExpression(condition))) {
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
            isEqualityOrNotToNull(expr) ||
            isStrictEqualityOrNotToNull(expr) ||
            isStrictEqualityOrNotToUndefined(expr) ||
            isStrictEqualityOrNotToVoidExpression(expr)
        );
    }

    function isEqualityOrNotToNull(expr: BinaryExpression) {
        const left = skipParens(expr.left);
        const right = skipParens(expr.right);
        return binaryCompare(
            doEqualityOrNotToNullCompare,
            left,
            expr.operatorToken,
            right
        );
    }

    // expr == null || expr != null
    // return expr
    function doEqualityOrNotToNullCompare(
        left: Expression,
        operator: Token<BinaryOperator>,
        right: Expression
    ) {
        return (operator.kind === SyntaxKind.EqualsEqualsToken ||
            operator.kind === SyntaxKind.ExclamationEqualsToken) &&
            right.kind === SyntaxKind.NullKeyword
            ? left
            : undefined;
    }

    function isStrictEqualityOrNotToUndefined(expr: BinaryExpression) {
        const left = skipParens(expr.left);
        const right = skipParens(expr.right);
        return binaryCompare(
            doStrictEqualityOrNotToUndefinedCompare,
            left,
            expr.operatorToken,
            right
        );
    }

    // expr === undefined || expr !== undefined
    // return expr
    function doStrictEqualityOrNotToUndefinedCompare(
        left: Expression,
        operator: Token<BinaryOperator>,
        right: Expression
    ) {
        return (operator.kind === SyntaxKind.EqualsEqualsEqualsToken ||
            operator.kind === SyntaxKind.ExclamationEqualsEqualsToken) &&
            (right.kind === SyntaxKind.UndefinedKeyword ||
                (isIdentifier(right) && right.text === 'undefined'))
            ? left
            : undefined;
    }

    function isStrictEqualityOrNotToNull(expr: BinaryExpression) {
        const left = skipParens(expr.left);
        const right = skipParens(expr.right);
        return binaryCompare(
            doStrictEqualityOrNotToNullCompare,
            left,
            expr.operatorToken,
            right
        );
    }

    // expr === null || expr !== null
    // return expr
    function doStrictEqualityOrNotToNullCompare(
        left: Expression,
        operator: Token<BinaryOperator>,
        right: Expression
    ) {
        return (operator.kind === SyntaxKind.EqualsEqualsEqualsToken ||
            operator.kind === SyntaxKind.ExclamationEqualsEqualsToken) &&
            right.kind === SyntaxKind.NullKeyword
            ? left
            : undefined;
    }

    function isStrictEqualityOrNotToVoidExpression(expr: BinaryExpression) {
        const left = skipParens(expr.left);
        const right = skipParens(expr.right);
        return binaryCompare(
            doStrictEqualityOrNotToVoidExpressionCompare,
            left,
            expr.operatorToken,
            right
        );
    }

    // expr === void * || expr !== void *
    // return expr
    function doStrictEqualityOrNotToVoidExpressionCompare(
        left: Expression,
        operator: Token<BinaryOperator>,
        right: Expression
    ) {
        return (operator.kind === SyntaxKind.EqualsEqualsEqualsToken ||
            operator.kind === SyntaxKind.ExclamationEqualsEqualsToken) &&
            isVoidExpression(right)
            ? left
            : undefined;
    }

    // expr === null || expr == undefined
    // expr !== null && expr !== undefined
    // return expr
    function isBinaryNullableEqualityOrNotExpression(expr: BinaryExpression) {
        if (
            expr.operatorToken.kind !== SyntaxKind.BarBarToken &&
            expr.operatorToken.kind !== SyntaxKind.AmpersandAmpersandToken
        )
            return undefined;
        /* istanbul ignore if */
        if (!isBinaryExpression(expr.left) || !isBinaryExpression(expr.right))
            return undefined;
        const left = isNullableEqualityExpression(expr.left);
        const right = isNullableEqualityExpression(expr.right);
        return left && right && isEqualityExpression(left, right)
            ? left
            : undefined;
    }
};
