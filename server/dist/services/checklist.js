"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultChecklist = getDefaultChecklist;
function getDefaultChecklist(participantId) {
    return [
        // Mecânica
        { participantId, category: 'Mecânica', label: 'Óleo do motor verificado' },
        { participantId, category: 'Mecânica', label: 'Pressão dos pneus verificada' },
        { participantId, category: 'Mecânica', label: 'Travões dianteiro e traseiro funcionais' },
        { participantId, category: 'Mecânica', label: 'Corrente/transmissão lubrificada e tensionada' },
        { participantId, category: 'Mecânica', label: 'Luzes (dianteira, traseira, indicadores) funcionais' },
        { participantId, category: 'Mecânica', label: 'Espelhos retrovisores ajustados' },
        { participantId, category: 'Mecânica', label: 'Bagagem fixada correctamente' },
        { participantId, category: 'Mecânica', label: 'Combustível suficiente para o raid' },
        // Equipamento Pessoal
        { participantId, category: 'Equipamento Pessoal', label: 'Capacete em bom estado' },
        { participantId, category: 'Equipamento Pessoal', label: 'Luvas de protecção' },
        { participantId, category: 'Equipamento Pessoal', label: 'Botas de protecção' },
        { participantId, category: 'Equipamento Pessoal', label: 'Casaco com protecções' },
        { participantId, category: 'Equipamento Pessoal', label: 'Calças de protecção' },
        { participantId, category: 'Equipamento Pessoal', label: 'Roupa impermeável (chuva)' },
        // Documentação
        { participantId, category: 'Documentação', label: 'Carta de condução válida' },
        { participantId, category: 'Documentação', label: 'Documento de registo da moto' },
        { participantId, category: 'Documentação', label: 'Seguro válido e vigente' },
        { participantId, category: 'Documentação', label: 'Documento de identificação (BI/CC/Passaporte)' },
        { participantId, category: 'Documentação', label: 'Kit de primeiros socorros' },
    ];
}
//# sourceMappingURL=checklist.js.map