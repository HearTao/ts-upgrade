import { e } from './foo';

export const bar = e !== undefined ? e : 42;

export const eee = 1 + 1 ? true : 22 || e !== undefined;
