import { Node, SourceFile, NodeFlags } from 'typescript';

export function deSynthesized(node: Node, sourceFile: SourceFile): Node {
    node.parent = sourceFile;
    node.flags &= ~NodeFlags.Synthesized;
    return node;
}
