import { FileTextChanges } from 'typescript';

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

export interface UpgradeContext {
    changes: FileTextChanges[];
}
