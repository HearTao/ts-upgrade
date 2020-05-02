/* istanbul ignore file */

import {
    Node,
    Symbol,
    SyntaxKind,
    ParenthesizedExpression,
    PrefixUnaryExpression,
    PropertyAccessExpression,
    ElementAccessExpression,
    isIdentifier,
    SymbolFlags,
    EnumDeclaration,
    isStringLiteralLike,
    EnumMember,
    NodeFlags,
    nodeIsMissing,
    Identifier,
    TypeChecker
} from 'typescript';

export enum EnumKind {
    Numeric,
    Literal
}

export function isValidConstAssertionArgument(
    node: Node,
    checker: TypeChecker
): boolean {
    switch (node.kind) {
        case SyntaxKind.StringLiteral:
        case SyntaxKind.NoSubstitutionTemplateLiteral:
        case SyntaxKind.NumericLiteral:
        case SyntaxKind.BigIntLiteral:
        case SyntaxKind.TrueKeyword:
        case SyntaxKind.FalseKeyword:
        case SyntaxKind.ArrayLiteralExpression:
        case SyntaxKind.ObjectLiteralExpression:
            return true;
        case SyntaxKind.ParenthesizedExpression:
            return isValidConstAssertionArgument(
                (<ParenthesizedExpression>node).expression,
                checker
            );
        case SyntaxKind.PrefixUnaryExpression:
            const op = (<PrefixUnaryExpression>node).operator;
            const arg = (<PrefixUnaryExpression>node).operand;
            return (
                (op === SyntaxKind.MinusToken &&
                    (arg.kind === SyntaxKind.NumericLiteral ||
                        arg.kind === SyntaxKind.BigIntLiteral)) ||
                (op === SyntaxKind.PlusToken &&
                    arg.kind === SyntaxKind.NumericLiteral)
            );
        case SyntaxKind.PropertyAccessExpression:
        case SyntaxKind.ElementAccessExpression:
            const expr = (<PropertyAccessExpression | ElementAccessExpression>(
                node
            )).expression;
            if (isIdentifier(expr)) {
                let symbol = checker.getSymbolAtLocation(expr);
                if (symbol && symbol.flags & SymbolFlags.Alias) {
                    symbol = checker.getAliasedSymbol(symbol);
                }
                return !!(
                    symbol &&
                    symbol.flags & SymbolFlags.Enum &&
                    getEnumKind(symbol, checker) === EnumKind.Literal
                );
            }
    }
    return false;
}

export function getEnumKind(symbol: Symbol, checker: TypeChecker): EnumKind {
    let hasNonLiteralMember = false;
    for (const declaration of symbol.declarations) {
        if (declaration.kind === SyntaxKind.EnumDeclaration) {
            for (const member of (<EnumDeclaration>declaration).members) {
                if (
                    member.initializer &&
                    isStringLiteralLike(member.initializer)
                ) {
                    return EnumKind.Literal;
                }
                if (!isLiteralEnumMember(member, checker)) {
                    hasNonLiteralMember = true;
                }
            }
        }
    }
    return hasNonLiteralMember ? EnumKind.Numeric : EnumKind.Literal;
}

export function isLiteralEnumMember(member: EnumMember, checker: TypeChecker) {
    const expr = member.initializer;
    if (!expr) {
        return !(member.flags & NodeFlags.Ambient);
    }
    switch (expr.kind) {
        case SyntaxKind.StringLiteral:
        case SyntaxKind.NumericLiteral:
        case SyntaxKind.NoSubstitutionTemplateLiteral:
            return true;
        case SyntaxKind.PrefixUnaryExpression:
            return (
                (<PrefixUnaryExpression>expr).operator ===
                    SyntaxKind.MinusToken &&
                (<PrefixUnaryExpression>expr).operand.kind ===
                    SyntaxKind.NumericLiteral
            );
        case SyntaxKind.Identifier:
            return (
                nodeIsMissing(expr) ||
                !!checker
                    .getSymbolAtLocation(member.parent)
                    ?.exports?.get((<Identifier>expr).escapedText)
            );
        default:
            return false;
    }
}
