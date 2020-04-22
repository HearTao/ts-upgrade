import { createSourceFile, ScriptTarget, forEachChild, Node, SyntaxKind, BinaryExpression, PropertyAccessExpression, PropertyAccessChain, ElementAccessExpression, CallExpression, isNullishCoalesce, FunctionDeclaration, isTypePredicateNode } from 'typescript'

export enum TypeScriptVersion {
    Before_v_2_0,
    v2_0,
    v2_1,
    v2_2,
    v2_3,
    v2_4,
    v2_5,
    v2_6,
    v2_7,
    v2_8,
    v2_9,
    v3_0,
    v3_1,
    v3_2,
    v3_3,
    v3_4,
    v3_5,
    v3_6,
    v3_7,
    V3_8
}

export function assumeVersion(code: string): TypeScriptVersion {
    let version: TypeScriptVersion = TypeScriptVersion.Before_v_2_0;

    const sourceFile = createSourceFile('', code, ScriptTarget.Latest);

    forEachChild(sourceFile, visitor)

    return version;

    function visitor(node: Node) {
        switch (node.kind) {
            case SyntaxKind.BinaryExpression:
                assumeBinaryExpression(node as BinaryExpression)
                break
            case SyntaxKind.PropertyAccessExpression:
                assumePropertyAccessExpression(node as PropertyAccessExpression)
                break
            case SyntaxKind.ElementAccessExpression:
                assumeElementAccessExpression(node as ElementAccessExpression)
                break
            case SyntaxKind.CallExpression:
                assumeCallExpression(node as CallExpression)
                break
            case SyntaxKind.FunctionDeclaration:
                assumeFunctionDeclaration(node as FunctionDeclaration)
                break
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
        assumeMaybeOptionalChain(expr)
    }

    function assumeElementAccessExpression(expr: ElementAccessExpression) {
        assumeMaybeOptionalChain(expr)
    }

    function assumeCallExpression(expr: CallExpression) {
        assumeMaybeOptionalChain(expr)
    }

    function assumeMaybeOptionalChain(expr: PropertyAccessExpression | ElementAccessExpression | CallExpression) {
        if (expr.questionDotToken) {
            advance(TypeScriptVersion.v3_7);
        }
    }

    function assumeFunctionDeclaration(decl: FunctionDeclaration) {
        if (isTypePredicateNode(decl.type)) {
            if (decl.type.assertsModifier.kind === SyntaxKind.AssertsKeyword) {
                advance(TypeScriptVersion.v3_7);
            }
        }
    }

    function advance(ver: TypeScriptVersion) {
        version = Math.max(version, ver);
    }
}

function main() {
    const codes = [
        'a?.b?.c',
        `a?.['b']`,
        'a.c?.()',
        'a ?? b',
        'declare function a(v: any): asserts v',
        'declare function a(v: any): asserts v is number',
    ]
    const versions = codes.map(assumeVersion)
    console.log(versions.map(v => TypeScriptVersion[v]))
}

main()