import { Request, Response, NextFunction } from 'express';
import { TokenPayload } from '../lib/jwt';
import { PermKey } from '../lib/permissions';
export interface AuthRequest extends Request {
    user?: TokenPayload;
}
export declare function authenticate(req: AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireRole(...roles: string[]): (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function requirePermission(perm: PermKey): (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function requirePlatformAdmin(req: AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map