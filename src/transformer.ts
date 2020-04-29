import {
    BinaryExpression,
    BinaryOperator,
    CallExpression,
    ConditionalExpression,
    createCallChain,
    createElementAccessChain,
    createNullishCoalesce,
    createPropertyAccessChain,
    createToken,
    ElementAccessExpression,
    Expression,
    isBinaryExpression,
    isCallExpression,
    isElementAccessExpression,
    isIdentifier,
    isPrivateIdentifier,
    isPropertyAccessExpression,
    isVoidExpression,
    Node,
    PropertyAccessExpression,
    SourceFile,
    SyntaxKind,
    Token,
    TransformerFactory,
    visitEachChild,
    visitNodes,
    AsExpression,
    isLiteralExpression,
    TypeChecker,
    createAsExpression,
    createKeywordTypeNode,
    createIdentifier,
    createTypeReferenceNode,
    isConstTypeReference,
    isKeyword,
    isObjectLiteralExpression,
    ParenthesizedExpression,
    PrefixUnaryExpression,
    SymbolFlags,
    EnumDeclaration,
    isStringLiteralLike,
    NodeFlags,
    EnumMember,
    Identifier,
    nodeIsMissing,
    Symbol,
    TypeFormatFlags,
    textChanges
} from 'typescript';
import { TypeScriptVersion } from '.';
import { cast, skipParens } from './utils';
import { deSynthesized, setParentContext } from './hack';
import { isValidConstAssertionArgument } from './internal';
import { UpgradeContext } from './types';

export const transformer: (
    sourceFile: SourceFile,
    checker: TypeChecker,
    changeTracker: textChanges.ChangeTracker,
    target: TypeScriptVersion
) => TransformerFactory<Node> = (
    sourceFile,
    checker,
    changeTracker,
    target
) => (context) => {
    return visitor;

    function visitor(node: Node): Node {
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
                return visitEachChild(node, visitor, context);
        }
    }

    function upgradeAsExpression(expr: AsExpression): Node {
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
                        visitEachChild(expression, visitor, context),
                        createTypeReferenceNode('const', undefined)
                    );
                    changeTracker.replaceNode(sourceFile, expr, newNode);
                    return newNode;
                }
            }
        }
        return visitEachChild(expr, visitor, context);
    }

    function upgradeConditionalExpression(expr: ConditionalExpression): Node {
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
                    visitEachChild(nullableConditionTarget, visitor, context),
                    visitEachChild(fallbackBranch, visitor, context)
                );
                changeTracker.replaceNode(sourceFile, expr, newNode);
                return newNode;
            }
        }
        return visitEachChild(expr, visitor, context);
    }

    function upgradeBinaryExpression(expr: BinaryExpression): Node {
        // a && a.b && a.b["c"] && a.b["c"]()
        // to
        // a?.b?.["c"]?.()
        const optionalChains = getOptionalChains(expr);
        if (optionalChains) {
            return createOptionalChains(expr, optionalChains);
        }
        return visitEachChild(expr, visitor, context);
    }

    function createOptionalChains(
        expr: BinaryExpression,
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
        changeTracker.replaceNode(sourceFile, expr, lastChain);
        return lastChain;
    }

    function createOptionalChainByChainableExpression(
        expr: ChainableExpression,
        left: Expression
    ) {
        switch (expr.kind) {
            case SyntaxKind.PropertyAccessExpression:
                return createPropertyAccessChain(
                    visitEachChild(left, visitor, context),
                    createToken(SyntaxKind.QuestionDotToken),
                    cast(expr.name, isIdentifier)
                );
            case SyntaxKind.ElementAccessExpression:
                return createElementAccessChain(
                    visitEachChild(left, visitor, context),
                    createToken(SyntaxKind.QuestionDotToken),
                    visitEachChild(expr.argumentExpression, visitor, context)
                );
            case SyntaxKind.CallExpression:
                const call = expr as CallExpression;
                return createCallChain(
                    visitEachChild(left, visitor, context),
                    createToken(SyntaxKind.QuestionDotToken),
                    call.typeArguments,
                    visitNodes(call.arguments, visitor)
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
        if (!isBinaryExpression(expr.left) || !isBinaryExpression(expr.right))
            return undefined;
        const left = isNullableEqualityExpression(expr.left);
        const right = isNullableEqualityExpression(expr.right);
        return left && right && isEqualityExpression(left, right)
            ? left
            : undefined;
    }
};
