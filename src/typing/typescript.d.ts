import { Program } from 'typescript';

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

        export class ChangeTracker {
            public static with(
                context: TextChangesContext,
                cb: (tracker: ChangeTracker) => void
            ): FileTextChanges[];
        }
    }

    export function getDefaultFormatCodeSettings(
        newLineCharacter?: string
    ): FormatCodeSettings;
}
