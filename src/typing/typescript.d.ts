import { Program, Type, SymbolTable } from 'typescript';

declare module 'typescript' {
    export namespace formatting {
        export interface FormatContext {
            readonly options: FormatCodeSettings;
            readonly getRules: unknown;
        }

        function getFormatContext(options: FormatCodeSettings): FormatContext;
    }

    export namespace textChanges {
        export interface TextChangesContext {
            host: LanguageServiceHost;
            formatContext: formatting.FormatContext;
            preferences: UserPreferences;
        }

        export interface ConfigurableStart {
            leadingTriviaOption?: LeadingTriviaOption;
        }

        export interface ConfigurableEnd {
            trailingTriviaOption?: TrailingTriviaOption;
        }

        export interface InsertNodeOptions {
            /**
             * Text to be inserted before the new node
             */
            prefix?: string;
            /**
             * Text to be inserted after the new node
             */
            suffix?: string;
            /**
             * Text of inserted node will be formatted with this indentation, otherwise indentation will be inferred from the old node
             */
            indentation?: number;
            /**
             * Text of inserted node will be formatted with this delta, otherwise delta will be inferred from the new node kind
             */
            delta?: number;
            /**
             * Do not trim leading white spaces in the edit range
             */
            preserveLeadingWhitespace?: boolean;
        }

        export enum LeadingTriviaOption {
            /** Exclude all leading trivia (use getStart()) */
            Exclude = 0,
            /** Include leading trivia and,
             * if there are no line breaks between the node and the previous token,
             * include all trivia between the node and the previous token
             */
            IncludeAll = 1,
            /**
             * Include attached JSDoc comments
             */
            JSDoc = 2,
            /**
             * Only delete trivia on the same line as getStart().
             * Used to avoid deleting leading comments
             */
            StartLine = 3
        }

        export enum TrailingTriviaOption {
            /** Exclude all trailing trivia (use getEnd()) */
            Exclude = 0,
            /** Include trailing trivia */
            Include = 1
        }

        export interface ConfigurableStartEnd
            extends ConfigurableStart,
                ConfigurableEnd {}

        export interface ChangeNodeOptions
            extends ConfigurableStartEnd,
                InsertNodeOptions {}

        export function applyChanges(
            text: string,
            changes: readonly TextChange[]
        ): string;

        export class ChangeTracker {
            public static with(
                context: TextChangesContext,
                cb: (tracker: ChangeTracker) => void
            ): FileTextChanges[];

            public replaceNode(
                sourceFile: SourceFile,
                oldNode: Node,
                newNode: Node,
                options?: ChangeNodeOptions
            ): void;

            delete(
                sourceFile: SourceFile,
                node: Node | NodeArray<TypeParameterDeclaration>
            ): void;

            public insertNodeBefore(
                sourceFile: SourceFile,
                before: Node,
                newNode: Node
            ): void;
        }
    }

    export namespace FindAllReferences {
        export const enum FindReferencesUse {
            /**
             * When searching for references to a symbol, the location will not be adjusted (this is the default behavior when not specified).
             */
            Other = 0,
            /**
             * When searching for references to a symbol, the location will be adjusted if the cursor was on a keyword.
             */
            References = 1,
            /**
             * When searching for references to a symbol, the location will be adjusted if the cursor was on a keyword.
             * Unlike `References`, the location will only be adjusted keyword belonged to a declaration with a valid name.
             * If set, we will find fewer references -- if it is referenced by several different names, we still only find references for the original name.
             */
            Rename = 2
        }

        export interface Options {
            readonly findInStrings?: boolean;
            readonly findInComments?: boolean;
            readonly use?: FindReferencesUse;
            /** True if we are searching for implementations. We will have a different method of adding references if so. */
            readonly implementations?: boolean;
            /**
             * True to opt in for enhanced renaming of shorthand properties and import/export specifiers.
             * The options controls the behavior for the whole rename operation; it cannot be changed on a per-file basis.
             * Default is false for backwards compatibility.
             */
            readonly providePrefixAndSuffixTextForRename?: boolean;
        }

        export const enum EntryKind {
            Span = 0,
            Node = 1,
            StringLiteral = 2,
            SearchedLocalFoundProperty = 3,
            SearchedPropertyFoundLocal = 4
        }

        export type NodeEntryKind =
            | EntryKind.Node
            | EntryKind.StringLiteral
            | EntryKind.SearchedLocalFoundProperty
            | EntryKind.SearchedPropertyFoundLocal;
        export type Entry = NodeEntry | SpanEntry;

        export interface ContextWithStartAndEndNode {
            start: Node;
            end: Node;
        }
        export type ContextNode = Node | ContextWithStartAndEndNode;
        export interface NodeEntry {
            readonly kind: NodeEntryKind;
            readonly node: Node;
            readonly context?: ContextNode;
        }
        export interface SpanEntry {
            readonly kind: EntryKind.Span;
            readonly fileName: string;
            readonly textSpan: TextSpan;
        }

        export function getReferenceEntriesForNode(
            position: number,
            node: Node,
            program: Program,
            sourceFiles: readonly SourceFile[],
            cancellationToken: CancellationToken,
            options?: Options,
            sourceFilesSet?: ReadonlyMap<true>
        ): readonly Entry[] | undefined;
    }

    export function getDefaultFormatCodeSettings(
        newLineCharacter?: string
    ): FormatCodeSettings;

    interface TypeChecker {
        isTypeAssignableTo(a: Type, b: Type): boolean;
    }

    interface SourceFile {
        path: string;
        locals: SymbolTable;
    }

    interface BaseChange {
        readonly sourceFile: SourceFile;
        readonly range: TextRange;
    }

    export function isKeyword(token: SyntaxKind): boolean;

    export function nodeIsMissing(node: Node | undefined): boolean;

    export function startEndOverlapsWithStartEnd(
        start1: number,
        end1: number,
        start2: number,
        end2: number
    ): boolean;

    export enum NodeFlags {
        Ambient = 1 << 23
    }
}
