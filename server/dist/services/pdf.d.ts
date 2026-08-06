interface PDFOptions {
    includeRoster?: boolean;
    includeRoutePoints?: boolean;
    includeContingency?: boolean;
    includeEmergencyContacts?: boolean;
    includeBriefing?: boolean;
    includeChecklist?: boolean;
    includeStatutes?: boolean;
    includeSignatures?: boolean;
}
export declare function generateRaidPDF(raid: any, club: any, options?: PDFOptions): Promise<Buffer>;
export declare function generateMemberCertificate(member: any, club: any, year: number): Promise<Buffer>;
export declare function generateAnnualReport(params: {
    club: any;
    year: number;
    raids: any[];
    members: any[];
    transactions: any[];
}): Promise<Buffer>;
export declare function generateMemberProfilePDF(member: any, club: any): Promise<Buffer>;
export declare function generateAllMembersProfilesPDF(members: any[], club: any): Promise<Buffer>;
export {};
//# sourceMappingURL=pdf.d.ts.map