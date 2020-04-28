import { Node, SourceFile, NodeFlags } from 'typescript';

export function deSynthesized(node: Node, sourceFile: SourceFile): Node {
    node.parent = sourceFile;
    node.flags &= ~NodeFlags.Synthesized;
    return node;
}

export function setParentContext<T>(node: Node, parent: Node, cb: () => T) {
    const savedParent = node.parent;
    node.parent = parent;
    const result = cb();
    node.parent = savedParent;
    return result;
}
