interface Foo {
    a?: {
        b: {
            c?: () => {
                d: number;
            };
        };
    };
}

export const a = 1 as 1;

declare const b: 1 | undefined;
export const c: 1 | undefined = b !== undefined ? b : a;

declare const d: Foo | undefined;
export const e = d && d.a && d.a.b && d.a.b.c && d.a.b.c() && d.a.b.c().d;
