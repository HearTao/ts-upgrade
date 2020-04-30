import {
    textChanges,
    SourceFile,
    Node,
    startEndOverlapsWithStartEnd,
    BaseChange,
    NodeArray,
    TypeParameterDeclaration
} from 'typescript';
import { lastOrUndefined } from './utils';

interface ChangesFetchable {
    readonly changes: BaseChange[];
}

export class ProxyChangesTracker implements textChanges.ChangeTracker {
    private queue: Map<string, BaseChange[]> = new Map<string, BaseChange[]>();
    private _needAnotherPass: boolean = false;

    constructor(private changeTracker: textChanges.ChangeTracker) { }
    
    delete(
        sourceFile: SourceFile,
        node: Node | NodeArray<TypeParameterDeclaration>
    ) {
        this.changeTracker.delete(sourceFile, node);
    }

    insertNodeAfter(
        sourceFile: SourceFile,
        after: Node,
        newNode: Node
    ) {
        this.changeTracker.insertNodeAfter(sourceFile, after, newNode);
    }

    replaceNode(
        sourceFile: SourceFile,
        oldNode: Node,
        newNode: Node,
        options?: textChanges.ChangeNodeOptions
    ): void {
        this.changeTracker.replaceNode(sourceFile, oldNode, newNode, options);
        const lastChange = this.getLastChanges();
        if (lastChange) {
            const changes = this.queue.get(lastChange.sourceFile.path) || [];
            if (
                changes.some((c) =>
                    startEndOverlapsWithStartEnd(
                        c.range.pos,
                        c.range.end,
                        lastChange.range.pos,
                        lastChange.range.end
                    )
                )
            ) {
                this.popLastChanges();
                this._needAnotherPass = true;
            } else {
                changes.push(lastChange);
            }
            this.queue.set(lastChange.sourceFile.path, changes);
        }
    }

    getLastChanges(): BaseChange | undefined {
        const fetchable = (this.changeTracker as unknown) as ChangesFetchable;
        return lastOrUndefined(fetchable.changes);
    }

    popLastChanges() {
        const fetchable = (this.changeTracker as unknown) as ChangesFetchable;
        return fetchable.changes.pop();
    }

    needAnotherPass() {
        return this._needAnotherPass;
    }
}
