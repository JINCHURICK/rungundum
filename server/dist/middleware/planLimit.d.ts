interface LimitError {
    error: string;
    nextPlanCode: string | null;
    activeMembers: number;
    memberLimit: number;
}
export declare function checkPlanLimit(clubId: string): Promise<LimitError | null>;
export {};
//# sourceMappingURL=planLimit.d.ts.map