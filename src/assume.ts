import {
    BinaryExpression,
    CallExpression,
    createSourceFile,
    ElementAccessExpression,
    forEachChild,
    FunctionDeclaration,
    isNullishCoalesce,
    isTypePredicateNode,
    Node,
    PropertyAccessExpression,
    ScriptTarget,
    SyntaxKind
} from 'typescript';
import { TypeScriptVersion } from './types';

export function assumeVersion(code: string): TypeScriptVersion {
    let version: TypeScriptVersion = TypeScriptVersion.Before_v_2_0;

    const sourceFile = createSourceFile('', code, ScriptTarget.Latest);

    forEachChild(sourceFile, visitor);

    return version;

    function visitor(node: Node) {
        switch (node.kind) {
            case SyntaxKind.BinaryExpression:
                assumeBinaryExpression(node as BinaryExpression);
                break;
            case SyntaxKind.PropertyAccessExpression:
                assumePropertyAccessExpression(
                    node as PropertyAccessExpression
                );
                break;
            case SyntaxKind.ElementAccessExpression:
                assumeElementAccessExpression(node as ElementAccessExpression);
                break;
            case SyntaxKind.CallExpression:
                assumeCallExpression(node as CallExpression);
                break;
            case SyntaxKind.FunctionDeclaration:
                assumeFunctionDeclaration(node as FunctionDeclaration);
                break;
            default:
                forEachChild(node, visitor);
        }
    }

    function assumeBinaryExpression(expr: BinaryExpression) {
        if (isNullishCoalesce(expr)) {
            advance(TypeScriptVersion.v3_7);
        }
    }

    function assumePropertyAccessExpression(expr: PropertyAccessExpression) {
        assumeMaybeOptionalChain(expr);
    }

    function assumeElementAccessExpression(expr: ElementAccessExpression) {
        assumeMaybeOptionalChain(expr);
    }

    function assumeCallExpression(expr: CallExpression) {
        assumeMaybeOptionalChain(expr);
    }

    function assumeMaybeOptionalChain(
        expr:
            | PropertyAccessExpression
            | ElementAccessExpression
            | CallExpression
    ) {
        if (expr.questionDotToken) {
            advance(TypeScriptVersion.v3_7);
        }
    }

    function assumeFunctionDeclaration(decl: FunctionDeclaration) {
        if (decl.type && isTypePredicateNode(decl.type)) {
            if (decl.type.assertsModifier?.kind === SyntaxKind.AssertsKeyword) {
                advance(TypeScriptVersion.v3_7);
            }
        }
    }

    function advance(ver: TypeScriptVersion) {
        version = Math.max(version, ver);
    }
}
