export declare function validateImageBuffer(buffer: Buffer): string;
export declare function validateDocumentBuffer(buffer: Buffer): string;
/**
 * Converte qualquer URL de imagem para data URI que o Puppeteer consegue renderizar.
 * URLs externas (Cloudinary) são redimensionadas e cacheadas em memória.
 * URLs locais são lidas do disco.
 * Protegido contra path traversal.
 */
export declare function resolveImageForPuppeteer(url: string | null | undefined): Promise<string | null>;
export declare function calibrateClockOffset(): Promise<void>;
export declare function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string>;
export declare function uploadDocumentToCloudinary(buffer: Buffer, folder: string): Promise<string>;
//# sourceMappingURL=cloudinary.d.ts.map