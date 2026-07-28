export declare function validateImageBuffer(buffer: Buffer): string;
/**
 * Converte URL local para data URI que o Puppeteer consegue renderizar.
 * Protegido contra path traversal.
 */
export declare function resolveImageForPuppeteer(url: string | null | undefined): string | null;
export declare function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string>;
//# sourceMappingURL=cloudinary.d.ts.map