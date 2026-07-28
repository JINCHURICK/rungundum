import { Request, Response, NextFunction } from 'express';
export declare function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function notFound(req: Request, res: Response): void;
//# sourceMappingURL=error.d.ts.map