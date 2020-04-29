import { Program, Type } from 'typescript';

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
            Exclude,
            /** Include leading trivia and,
             * if there are no line breaks between the node and the previous token,
             * include all trivia between the node and the previous token
             */
            IncludeAll,
            /**
             * Include attached JSDoc comments
             */
            JSDoc,
            /**
             * Only delete trivia on the same line as getStart().
             * Used to avoid deleting leading comments
             */
            StartLine
        }

        export enum TrailingTriviaOption {
            /** Exclude all trailing trivia (use getEnd()) */
            Exclude,
            /** Include trailing trivia */
            Include
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
        }
    }

    export function getDefaultFormatCodeSettings(
        newLineCharacter?: string
    ): FormatCodeSettings;

    interface TypeChecker {
        isTypeAssignableTo(a: Type, b: Type): boolean;
    }

    export function isKeyword(token: SyntaxKind): boolean;

    export function nodeIsMissing(node: Node | undefined): boolean;

    export enum NodeFlags {
        Ambient = 1 << 23
    }
}
