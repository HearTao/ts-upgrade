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
    ExportDeclaration,
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
    TypeFormatFlags,
    isImportDeclaration,
    isNamespaceImport,
    NamespaceImport,
    isExportDeclaration,
    isNamespaceExport,
    NamespaceExport,
    ImportDeclaration,
    isNamedExports,
    NamedExports,
    ExportSpecifier,
    Identifier,
    createExportDeclaration,
    createNamespaceExport,
    createNodeArray,
    createNamedExports,
    createImportClause
} from 'typescript';
import { TypeScriptVersion } from '.';
import { deSynthesized, setParentContext } from './hack';
import { isValidConstAssertionArgument } from './internal';
import { cast, skipParens, assertDef } from './utils';

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


    upgradeExportAsNsExpression(getTopLevelNodes());

    //FIXME: Need a better way to get the top nodes.
    function getTopLevelNodes(): Node[] {
        return sourceFile
            .getChildren()
            .find(node => node.kind === SyntaxKind.SyntaxList)
            ?.getChildren() || [];
    }

    function upgradeExportAsNsExpression(children: Node[]): void {
        const namespaceImportPairs = children.map(getNamespaceImport).filter(assertDef);
        const namedExportsPairs = children.map(getNamesExports).filter(assertDef);
        for (const [exportNode, named] of namedExportsPairs) {
            const exportSpecifiers = named.elements;
            const newExports: ExportSpecifier[] = [];
            for (const specifier of exportSpecifiers) {
                const propertyName = specifier.propertyName ?? specifier.name;
                const matchImportIndex = namespaceImportPairs
                    .findIndex(pair => isEqualityExpression(pair[1].name, propertyName));
                if (matchImportIndex === -1) {
                    newExports.push(specifier);
                    continue;
                }
                const importExpr = namespaceImportPairs[matchImportIndex][0];
                const expression = createExportDeclaration(
                    undefined,
                    undefined,
                    createNamespaceExport(specifier.name),
                    importExpr.moduleSpecifier
                );
                changeTracker.insertNodeAfter(sourceFile, exportNode, expression);
                removeNamespaceFromImport(namespaceImportPairs, matchImportIndex);
            }
            if (newExports.length) {
                const specifiers = createNodeArray(newExports, exportSpecifiers.hasTrailingComma);
                changeTracker.replaceNode(sourceFile, named, createNamedExports(specifiers));
            } else {
                changeTracker.delete(sourceFile, exportNode);
            }
        }
    }


    function removeNamespaceFromImport(namespaceImportPairs: [ImportDeclaration, NamespaceImport][], index: number) {
        const [importExpr] = namespaceImportPairs[index];
        const importClause = importExpr.importClause!;
        if (importClause.name === undefined) {
            changeTracker.delete(sourceFile, importExpr);
            namespaceImportPairs.splice(index, 1);
        } else {
            changeTracker.replaceNode(sourceFile, importClause, createImportClause(
                importClause.name!,
                undefined,
                importClause.isTypeOnly
            ));
        }
    }


    function getNamespaceImport(node: Node): [ImportDeclaration, NamespaceImport] | undefined {
        if (!isImportDeclaration(node)) return undefined;
        const namespace = node.importClause?.namedBindings;
        if (namespace === undefined || !isNamespaceImport(namespace)) return undefined;
        return [node, namespace];
    }

    function getNamesExports(node: Node): [ExportDeclaration, NamedExports] | undefined {
        if (!isExportDeclaration(node)) return undefined;
        const named = node.exportClause;
        if (named === undefined || !isNamedExports(named)) return undefined;
        return [node, named];
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
            createOptionalChains(expr, optionalChains);
        }
        return forEachChild(expr, visitor);
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
                return createCallChain(
                    left,
                    createToken(SyntaxKind.QuestionDotToken),
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
