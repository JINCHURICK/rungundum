export declare const PERM: {
    readonly RAIDS_WRITE: readonly ["ADMIN", "VICE_PRESIDENT", "CAPTAIN"];
    readonly MEMBERS_READ: readonly ["ADMIN", "VICE_PRESIDENT", "CAPTAIN", "SECRETARY", "PR", "TREASURER", "DISCIPLINA"];
    readonly MEMBERS_WRITE: readonly ["ADMIN", "VICE_PRESIDENT", "CAPTAIN", "SECRETARY"];
    readonly TREASURY: readonly ["ADMIN", "VICE_PRESIDENT", "TREASURER"];
    readonly QUOTAS: readonly ["ADMIN", "VICE_PRESIDENT", "TREASURER"];
    readonly DISCIPLINARY: readonly ["ADMIN", "VICE_PRESIDENT", "DISCIPLINA"];
    readonly ANNOUNCEMENTS_WRITE: readonly ["ADMIN", "VICE_PRESIDENT", "SECRETARY", "PR"];
    readonly ANNOUNCEMENTS_READ: readonly ["ADMIN", "VICE_PRESIDENT", "CAPTAIN", "TREASURER", "SECRETARY", "PR", "DISCIPLINA", "MEMBER", "GUEST"];
    readonly SMS: readonly ["ADMIN", "VICE_PRESIDENT", "TREASURER", "SECRETARY", "PR", "DISCIPLINA"];
    readonly POSITIONS_WRITE: readonly ["ADMIN", "VICE_PRESIDENT", "SECRETARY"];
    readonly POSITIONS_READ: readonly ["ADMIN", "VICE_PRESIDENT", "CAPTAIN", "TREASURER", "SECRETARY", "PR", "DISCIPLINA", "MEMBER"];
    readonly STATS: readonly ["ADMIN", "VICE_PRESIDENT", "CAPTAIN", "TREASURER", "SECRETARY", "PR", "DISCIPLINA"];
    readonly CLUB_CONFIG: readonly ["ADMIN"];
    readonly SUBSCRIPTIONS: readonly ["ADMIN"];
    readonly ALERTS_CONFIG: readonly ["ADMIN", "VICE_PRESIDENT", "TREASURER"];
};
export type PermKey = keyof typeof PERM;
export declare function can(role: string | undefined | null, perm: PermKey): boolean;
//# sourceMappingURL=permissions.d.ts.map