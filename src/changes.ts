import {
    textChanges,
    SourceFile,
    Node,
    startEndOverlapsWithStartEnd,
    BaseChange
} from 'typescript';
import { lastOrUndefined } from './utils';

interface ChangesFetchable {
    readonly changes: BaseChange[];
}

export class ProxyChangesTracker implements textChanges.ChangeTracker {
    private queue: Map<string, BaseChange[]> = new Map<string, BaseChange[]>();
    private _needAnotherPass: boolean = false;

    constructor(private changeTracker: textChanges.ChangeTracker) {}

    checkOverlap() {
        const lastChange = this.getLastChanges();
        /* istanbul ignore next */
        if (lastChange) {
            const changes = this.queue.get(lastChange.sourceFile.path) || [];
            if (
                changes.some(c =>
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

    deleteNodeRange(
        sourceFile: SourceFile,
        startNode: Node,
        endNode: Node,
        options?: textChanges.ConfigurableStartEnd
    ) {
        this.changeTracker.deleteNodeRange(
            sourceFile,
            startNode,
            endNode,
            options
        );
        this.checkOverlap();
    }

    insertNodeBefore(sourceFile: SourceFile, before: Node, newNode: Node) {
        this.changeTracker.insertNodeBefore(sourceFile, before, newNode);
        this.checkOverlap();
    }

    replaceNode(
        sourceFile: SourceFile,
        oldNode: Node,
        newNode: Node,
        options?: textChanges.ChangeNodeOptions
    ): void {
        this.changeTracker.replaceNode(sourceFile, oldNode, newNode, options);
        this.checkOverlap();
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
