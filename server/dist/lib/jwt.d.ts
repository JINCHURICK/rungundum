export interface TokenPayload {
    userId: string;
    clubId: string;
    role: string;
    platformAdmin?: boolean;
    tv?: number;
}
export declare function signAccessToken(payload: TokenPayload): string;
export declare function signRefreshToken(payload: TokenPayload): string;
export declare function verifyAccessToken(token: string): TokenPayload;
export declare function verifyRefreshToken(token: string): TokenPayload;
//# sourceMappingURL=jwt.d.ts.map