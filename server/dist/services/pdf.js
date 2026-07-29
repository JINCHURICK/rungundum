"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRaidPDF = generateRaidPDF;
exports.generateMemberCertificate = generateMemberCertificate;
exports.generateAnnualReport = generateAnnualReport;
const puppeteer_1 = __importDefault(require("puppeteer"));
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
const cloudinary_1 = require("./cloudinary");
const checklist_1 = require("./checklist");
async function generateRaidPDF(raid, club, options = {}) {
    const resolvedLogoUrl = (0, cloudinary_1.resolveImageForPuppeteer)(club.logoUrl);
    club = { ...club, logoUrl: resolvedLogoUrl };
    // Resolver fotos dos participantes para base64 (necessário para Puppeteer em dev)
    const resolvedParticipants = (raid.participants ?? []).map((p) => ({
        ...p,
        member: { ...p.member, resolvedPhotoUrl: (0, cloudinary_1.resolveImageForPuppeteer)(p.member?.photoUrl) },
    }));
    const opts = {
        includeRoster: true,
        includeRoutePoints: true,
        includeContingency: true,
        includeEmergencyContacts: true,
        includeBriefing: true,
        includeChecklist: false,
        includeStatutes: false,
        includeSignatures: false,
        ...options,
    };
    const accentColor = club.accentColor ?? '#dc2626';
    const raidDate = (0, date_fns_1.format)(new Date(raid.date), "dd 'de' MMMM 'de' yyyy", { locale: locale_1.ptBR });
    const clubName = club.name;
    const leaders = resolvedParticipants.filter((p) => p.role === 'LEADER');
    const leaderName = leaders[0]?.member?.nickname ?? leaders[0]?.member?.fullName ?? '—';
    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 10pt; color: #1a1a1a; background: white; }
  .page { padding: 10mm 18mm 6mm 18mm; position: relative; }

  /* ── Page break: nada parte a meio ── */
  .section { margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
  .section-title { font-size: 11pt; font-weight: 700; color: white; background: ${accentColor}; padding: 5px 12px; border-radius: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; break-after: avoid; page-break-after: avoid; }
  .metrics { display: flex; gap: 12px; margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
  .contingency-item { background: #fff8f8; border-left: 3px solid ${accentColor}; padding: 8px 12px; margin-bottom: 8px; border-radius: 0 4px 4px 0; break-inside: avoid; page-break-inside: avoid; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; break-inside: avoid; page-break-inside: avoid; }
  .info-grid { break-inside: avoid; page-break-inside: avoid; }
  .briefing { break-inside: avoid; page-break-inside: avoid; }
  .signatures { break-inside: avoid; page-break-inside: avoid; }

  /* ── Header ── */
  .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 3px solid ${accentColor}; margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
  .header-logo { height: 56px; object-fit: contain; }
  .header-club { text-align: center; }
  .header-club h1 { font-size: 18pt; font-weight: 800; color: ${accentColor}; letter-spacing: -0.5px; }
  .header-club p { font-size: 9pt; color: #666; margin-top: 2px; }
  .header-meta { text-align: right; font-size: 8pt; color: #888; }
  .header-meta strong { display: block; font-size: 10pt; color: #333; }

  /* ── Metrics ── */
  .metric { flex: 1; background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 6px; padding: 10px 14px; text-align: center; }
  .metric-value { font-size: 16pt; font-weight: 800; color: ${accentColor}; }
  .metric-label { font-size: 7.5pt; color: #888; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.3px; }

  /* ── Info grid ── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; break-inside: avoid; page-break-inside: avoid; }
  .info-item { display: flex; gap: 6px; font-size: 9pt; }
  .info-label { color: #888; min-width: 110px; }
  .info-value { font-weight: 600; color: #1a1a1a; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { background: ${accentColor}20; color: ${accentColor}; font-weight: 700; padding: 6px 10px; text-align: left; border-bottom: 2px solid ${accentColor}40; }
  td { padding: 5px 10px; border-bottom: 1px solid #f0f0f0; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #fafafa; }

  /* ── Badge ── */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 7.5pt; font-weight: 700; }
  .badge-leader   { background: ${accentColor}20; color: ${accentColor}; }
  .badge-tail     { background: #1e40af20; color: #1e40af; }
  .badge-member   { background: #16a34a20; color: #16a34a; }
  .badge-mechanic { background: #78350f20; color: #78350f; }
  .badge-support  { background: #92400e20; color: #92400e; }

  /* ── Contingency ── */
  .contingency-title { font-weight: 700; font-size: 9pt; color: ${accentColor}; margin-bottom: 3px; }
  .contingency-text { font-size: 8.5pt; line-height: 1.5; color: #333; }

  /* ── Briefing ── */
  .briefing { background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 14px 16px; font-size: 9pt; line-height: 1.7; }
  .briefing p { margin-bottom: 8px; }

  /* ── Pilot Checklist Cards ── */
  .pilot-card { border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 14px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  .pilot-card-header { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f5f5f5; border-bottom: 1px solid #e0e0e0; }
  .pilot-avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid ${accentColor}; }
  .pilot-avatar-placeholder { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; background: ${accentColor}22; display: flex; align-items: center; justify-content: center; font-size: 15pt; font-weight: 800; color: ${accentColor}; border: 2px solid ${accentColor}44; }
  .pilot-info { flex: 1; }
  .pilot-name { font-weight: 700; font-size: 10pt; color: #1a1a1a; }
  .pilot-sub { font-size: 7.5pt; color: #888; margin-top: 1px; }
  .pilot-progress { font-size: 8pt; font-weight: 700; color: #16a34a; white-space: nowrap; }
  .pilot-progress.incomplete { color: #b45309; }
  .pilot-items-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
  .pilot-items-col { padding: 8px 12px; }
  .pilot-items-col:not(:last-child) { border-right: 1px solid #f0f0f0; }
  .pilot-cat-title { font-size: 7pt; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 5px; }
  .checklist-item { display: flex; align-items: flex-start; gap: 5px; margin-bottom: 4px; font-size: 7.5pt; line-height: 1.3; }
  .checklist-box { width: 11px; height: 11px; border: 1.5px solid #bbb; border-radius: 2px; flex-shrink: 0; margin-top: 1px; display: flex; align-items: center; justify-content: center; }
  .checklist-box.checked { background: #16a34a; border-color: #16a34a; color: white; font-size: 7pt; font-weight: 900; line-height: 1; }

  /* ── Hand Signals ── */
  .signals-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .signal-card { border: 1px solid #e8e8e8; border-radius: 6px; overflow: hidden; break-inside: avoid; }
  .signal-img { width: 100%; height: 80px; object-fit: cover; }
  .signal-placeholder { width: 100%; height: 80px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; font-size: 22pt; color: #ddd; }
  .signal-body { padding: 6px 8px; }
  .signal-name { font-size: 8.5pt; font-weight: 700; color: #1a1a1a; }
  .signal-desc { font-size: 7.5pt; color: #666; line-height: 1.4; margin-top: 2px; }

  /* ── Signatures ── */
  .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 12px; }
  .signature-box { border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 30px; }
  .signature-name { font-size: 8pt; color: #666; margin-top: 4px; text-align: center; }

  /* footer gerido pelo puppeteer displayHeaderFooter — sem CSS aqui */

  /* ── Route type badges ── */
  .route-type { font-size: 7pt; padding: 1px 6px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
  .rt-DEPARTURE { background: #dcfce7; color: #16a34a; }
  .rt-ARRIVAL   { background: #dbeafe; color: #1d4ed8; }
  .rt-STOP      { background: #f1f5f9; color: #475569; }
  .rt-TECH_STOP { background: #f3e8ff; color: #7c3aed; }
  .rt-BREAKFAST { background: #fef3c7; color: #b45309; }
  .rt-LUNCH     { background: #fef9c3; color: #a16207; }
  .rt-COFFEE    { background: #fdf4ff; color: #9333ea; }
  .rt-FUEL      { background: #fef2f2; color: #dc2626; }
  .rt-OVERNIGHT { background: #ffedd5; color: #c2410c; }
  .rt-SCENIC    { background: #ecfdf5; color: #059669; }
  .rt-BORDER    { background: #eff6ff; color: #2563eb; }
</style>
</head>
<body>
<div class="page">

<!-- HEADER -->
<div class="header">
  ${club.logoUrl ? `<img src="${club.logoUrl}" class="header-logo" alt="Logo">` : '<div style="width:56px"></div>'}
  <div class="header-club">
    <h1>${clubName}</h1>
    <p>${club.motto ?? 'Plano de Raid'}</p>
  </div>
  <div class="header-meta">
    <strong>${raid.title}</strong>
    ${raidDate}<br>
    Ref: ${raid.id.slice(-8).toUpperCase()}
  </div>
</div>

<!-- METRICS -->
<div class="metrics">
  <div class="metric">
    <div class="metric-value">${raid.estimatedKm ? `${raid.estimatedKm} km` : '—'}</div>
    <div class="metric-label">Distância</div>
  </div>
  <div class="metric">
    <div class="metric-value">${raid.estimatedDuration ?? '—'}</div>
    <div class="metric-label">Duração</div>
  </div>
  <div class="metric">
    <div class="metric-value">${resolvedParticipants.length}</div>
    <div class="metric-label">Participantes</div>
  </div>
  <div class="metric">
    <div class="metric-value">${getDifficultyLabel(raid.difficulty)}</div>
    <div class="metric-label">Dificuldade</div>
  </div>
</div>

<!-- GENERAL INFO -->
<div class="section">
  <div class="section-title">Informação Geral</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Origem:</span><span class="info-value">${raid.origin}</span></div>
    <div class="info-item"><span class="info-label">Destino:</span><span class="info-value">${raid.destination}</span></div>
    <div class="info-item"><span class="info-label">Data:</span><span class="info-value">${raidDate}</span></div>
    <div class="info-item"><span class="info-label">Capitão de Estrada:</span><span class="info-value">${leaderName}</span></div>
    <div class="info-item"><span class="info-label">Vel. máx. comboio:</span><span class="info-value">${raid.maxSpeed ? `${raid.maxSpeed} km/h` : '—'}</span></div>
    <div class="info-item"><span class="info-label">Canal rádio:</span><span class="info-value">${raid.communicationChannel ?? '—'}</span></div>
    <div class="info-item"><span class="info-label">Tipo de estrada:</span><span class="info-value">${(raid.roadTypes ?? []).join(', ') || '—'}</span></div>
    ${raid.accommodation ? `<div class="info-item"><span class="info-label">Alojamento:</span><span class="info-value">${raid.accommodation}</span></div>` : ''}
  </div>
  ${raid.description ? `<p style="margin-top:10px;font-size:9pt;color:#555;line-height:1.5">${raid.description}</p>` : ''}
</div>

${opts.includeRoutePoints && raid.routePoints?.length ? `
<!-- ROUTE POINTS -->
<div class="section">
  <div class="section-title">Roteiro</div>
  <table>
    <thead><tr><th>#</th><th>Local</th><th>Tipo</th><th>Hora</th><th>KM</th><th>Paragem</th><th>Notas</th></tr></thead>
    <tbody>
      ${raid.routePoints.map((rp, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${rp.name}</strong></td>
        <td><span class="route-type rt-${rp.type}">${getRouteTypeLabel(rp.type)}</span></td>
        <td>${rp.scheduledTime ?? '—'}</td>
        <td>${rp.kmAccumulated != null ? `${rp.kmAccumulated} km` : '—'}</td>
        <td>${rp.stopDuration ? `${rp.stopDuration} min` : '—'}</td>
        <td style="color:#666">${rp.notes ?? ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>
` : ''}

${opts.includeRoster && resolvedParticipants.length ? `
<!-- PARTICIPANTS -->
<div class="section">
  <div class="section-title">Equipa (${resolvedParticipants.length} participantes)</div>
  <table>
    <thead><tr><th>Nome</th><th>Alcunha</th><th>Função</th><th>Moto</th><th>Matrícula</th><th>Contacto</th></tr></thead>
    <tbody>
      ${resolvedParticipants.map((p) => `
      <tr>
        <td>${p.member?.fullName ?? '—'}</td>
        <td>${p.member?.nickname ?? '—'}</td>
        <td><span class="badge badge-${p.role.toLowerCase()}">${getRoleLabel(p.role)}</span></td>
        <td>${p.vehicle ? `${p.vehicle.brand} ${p.vehicle.model}` : '—'}</td>
        <td>${p.vehicle?.plate ?? '—'}</td>
        <td>${p.member?.phone ?? '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>
` : ''}

${opts.includeContingency && raid.contingencyPlan ? `
<!-- CONTINGENCY -->
<div class="section">
  <div class="section-title">Plano de Contingência</div>
  ${raid.contingencyPlan.accidentText ? `<div class="contingency-item"><div class="contingency-title">🚨 Acidente / Queda</div><div class="contingency-text">${raid.contingencyPlan.accidentText}</div></div>` : ''}
  ${raid.contingencyPlan.breakdownText ? `<div class="contingency-item"><div class="contingency-title">🔧 Avaria de Moto</div><div class="contingency-text">${raid.contingencyPlan.breakdownText}</div></div>` : ''}
  ${raid.contingencyPlan.separationText ? `<div class="contingency-item"><div class="contingency-title">📡 Separação de Piloto</div><div class="contingency-text">${raid.contingencyPlan.separationText}</div></div>` : ''}
  ${raid.contingencyPlan.weatherText ? `<div class="contingency-item"><div class="contingency-title">⛈️ Condições Meteorológicas Adversas</div><div class="contingency-text">${raid.contingencyPlan.weatherText}</div></div>` : ''}
  ${raid.contingencyPlan.rallyPoint ? `<p style="margin-top:8px;font-size:9pt"><strong>Ponto de reagrupamento de emergência:</strong> ${raid.contingencyPlan.rallyPoint}</p>` : ''}
</div>
` : ''}

${opts.includeEmergencyContacts && Array.isArray(raid.contingencyPlan?.contactsJson) && raid.contingencyPlan.contactsJson.length ? `
<!-- EMERGENCY CONTACTS -->
<div class="section">
  <div class="section-title">Contactos de Emergência</div>
  <table>
    <thead><tr><th>Nome</th><th>Função</th><th>Telefone</th></tr></thead>
    <tbody>
      ${raid.contingencyPlan.contactsJson.map((c) => `
      <tr><td>${c.name}</td><td>${c.role}</td><td>${c.phone}</td></tr>`).join('')}
    </tbody>
  </table>
</div>
` : ''}

${opts.includeBriefing ? `
<!-- BRIEFING -->
<div class="section">
  <div class="section-title">Guião de Briefing</div>
  <div class="briefing">
    <p><strong>Bom dia a todos!</strong> Bem-vindos ao raid <em>${raid.title}</em>.</p>
    <p>Hoje percorremos aproximadamente <strong>${raid.estimatedKm ?? '?'} km</strong> de ${raid.origin} até ${raid.destination}.</p>
    <p>A <strong>velocidade máxima em comboio</strong> é de ${raid.maxSpeed ?? '?'} km/h. Mantenham sempre uma distância segura entre motos.</p>
    <p>O <strong>canal de comunicação</strong> é o ${raid.communicationChannel ?? '?'}. Em caso de emergência, o líder de estrada é ${leaderName}.</p>
    <p>Em caso de separação: <strong>parem no próximo ponto seguro e avisem via rádio ou telefone.</strong></p>
    <p>Bom raid para todos — com segurança e bom humor!</p>
  </div>
</div>
` : ''}

${opts.includeChecklist ? `
<!-- CHECKLIST POR PILOTO -->
<div class="section">
  <div class="section-title">Checklist dos Pilotos</div>
  ${resolvedParticipants.map((p) => {
        const photo = p.member?.resolvedPhotoUrl;
        const initial = (p.member?.nickname ?? p.member?.fullName ?? '?').charAt(0).toUpperCase();
        const name = p.member?.nickname ?? p.member?.fullName ?? '—';
        const vehicle = p.vehicle ? `${p.vehicle.brand} ${p.vehicle.model}` : 'Moto não definida';
        const items = p.checklistItems?.length ? p.checklistItems : (0, checklist_1.getDefaultChecklist)('').map((i) => ({ ...i, checked: false }));
        const cats = ['Mecânica', 'Equipamento Pessoal', 'Documentação'];
        const done = items.filter((i) => i.checked).length;
        const total = items.length;
        const isComplete = done === total && total > 0;
        return `
    <div class="pilot-card">
      <div class="pilot-card-header">
        ${photo
            ? `<img src="${photo}" class="pilot-avatar" alt="${name}">`
            : `<div class="pilot-avatar-placeholder">${initial}</div>`}
        <div class="pilot-info">
          <div class="pilot-name">${name}</div>
          <div class="pilot-sub">${vehicle} &nbsp;·&nbsp; <span class="badge badge-${p.role?.toLowerCase()}">${getRoleLabel(p.role)}</span></div>
        </div>
        <div class="pilot-progress ${isComplete ? '' : 'incomplete'}">${done}/${total} ✓</div>
      </div>
      <div class="pilot-items-grid">
        ${cats.map((cat) => {
            const catItems = items.filter((i) => i.category === cat);
            return `
          <div class="pilot-items-col">
            <div class="pilot-cat-title">${cat}</div>
            ${catItems.map((item) => `
            <div class="checklist-item">
              <div class="checklist-box ${item.checked ? 'checked' : ''}">${item.checked ? '✓' : ''}</div>
              <span>${item.label}</span>
            </div>`).join('')}
          </div>`;
        }).join('')}
      </div>
    </div>`;
    }).join('')}
</div>
` : ''}

${club.handSignals?.length ? `
<!-- SINAIS DE MÃO -->
<div class="section">
  <div class="section-title">Sinais de Mão do Clube</div>
  <div class="signals-grid">
    ${club.handSignals.map((s) => `
    <div class="signal-card">
      ${s.imageUrl
        ? `<img src="${s.imageUrl}" class="signal-img" alt="${s.name}">`
        : `<div class="signal-placeholder">🤚</div>`}
      <div class="signal-body">
        <div class="signal-name">${s.name}</div>
        ${s.description ? `<div class="signal-desc">${s.description}</div>` : ''}
      </div>
    </div>`).join('')}
  </div>
</div>
` : ''}

${opts.includeSignatures && resolvedParticipants.length ? `
<!-- SIGNATURES -->
<div class="section">
  <div class="section-title">Confirmação de Participação</div>
  <div class="signatures">
    ${resolvedParticipants.map((p) => `
    <div>
      <div class="signature-box"></div>
      <div class="signature-name">${p.member?.fullName ?? '—'}</div>
    </div>`).join('')}
  </div>
</div>
` : ''}

${opts.includeStatutes && club.statutesText ? `
<!-- STATUTES -->
<div class="section">
  <div class="section-title">Estatuto do Clube</div>
  <div style="font-size:8.5pt;line-height:1.6;color:#444;white-space:pre-wrap">${club.statutesText}</div>
</div>
` : ''}

</div>
</body>
</html>`;
    const footerTemplate = `
    <div style="width:100%;display:flex;justify-content:space-between;align-items:center;
                font-family:'Segoe UI',Arial,sans-serif;font-size:7pt;color:#aaa;
                border-top:1px solid #e5e5e5;padding:4px 18mm 0;box-sizing:border-box;">
      <span>${clubName} &middot; RaidManager</span>
      <span>${raid.title} &middot; ${raidDate}</span>
      <span>Pag. <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`;
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate,
        margin: { top: '14mm', right: '0', bottom: '16mm', left: '0' },
    });
    await browser.close();
    return Buffer.from(pdf);
}
function getDifficultyLabel(d) {
    return { EASY: 'Fácil', MEDIUM: 'Médio', HARD: 'Difícil' }[d ?? 'MEDIUM'] ?? d ?? '—';
}
function getRoleLabel(r) {
    return { LEADER: 'Líder', TAIL: 'Cauda', MEMBER: 'Membro', MECHANIC: 'Mecânico', SUPPORT: 'Apoio' }[r] ?? r;
}
function getRouteTypeLabel(t) {
    return {
        DEPARTURE: 'Saída', ARRIVAL: 'Chegada', STOP: 'Paragem',
        TECH_STOP: 'Pausa Técnica', BREAKFAST: 'Peq. Almoço', LUNCH: 'Almoço',
        COFFEE: 'Café', FUEL: 'Abastecimento', OVERNIGHT: 'Pernoita',
        SCENIC: 'Panorâmico', BORDER: 'Fronteira',
    }[t] ?? t;
}
// ─────────────────────────────────────────────────────────────────────────────
// Certificado Anual de Membro
// ─────────────────────────────────────────────────────────────────────────────
async function generateMemberCertificate(member, club, year) {
    const accentColor = club.accentColor ?? '#dc2626';
    const resolvedLogoUrl = (0, cloudinary_1.resolveImageForPuppeteer)(club.logoUrl);
    const resolvedPhotoUrl = (0, cloudinary_1.resolveImageForPuppeteer)(member.photoUrl);
    const participations = member.participations ?? [];
    const totalRaids = participations.length;
    const totalKm = Math.round(participations.reduce((sum, p) => sum + (p.raid?.estimatedKm ?? 0), 0));
    // Contagem de funções exercidas
    const roleCounts = {};
    for (const p of participations) {
        const label = getRoleLabel(p.role ?? 'MEMBER');
        roleCounts[label] = (roleCounts[label] ?? 0) + 1;
    }
    const rolesText = Object.entries(roleCounts)
        .map(([role, count]) => `${role} (${count}×)`)
        .join(' · ') || '—';
    const initial = (member.nickname ?? member.fullName ?? '?').charAt(0).toUpperCase();
    const issueDate = (0, date_fns_1.format)(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: locale_1.ptBR });
    const memberSince = member.joinedAt
        ? (0, date_fns_1.format)(new Date(member.joinedAt), "MMMM 'de' yyyy", { locale: locale_1.ptBR })
        : null;
    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 10pt; color: #1a1a1a; background: white; }

  .page {
    padding: 20mm 20mm 18mm 20mm;
    min-height: 257mm;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  /* Bordas decorativas duplas */
  .border-outer {
    position: fixed;
    top: 6mm; left: 6mm; right: 6mm; bottom: 6mm;
    border: 3px solid ${accentColor};
    border-radius: 6px;
    pointer-events: none;
  }
  .border-inner {
    position: fixed;
    top: 9mm; left: 9mm; right: 9mm; bottom: 9mm;
    border: 0.75px solid ${accentColor}55;
    border-radius: 4px;
    pointer-events: none;
  }

  /* Cabeçalho */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 3px solid ${accentColor};
    margin-bottom: 24px;
  }
  .header-logo { height: 54px; object-fit: contain; }
  .header-logo-placeholder { width: 54px; }
  .header-center { text-align: center; flex: 1; }
  .header-club { font-size: 17pt; font-weight: 900; color: ${accentColor}; letter-spacing: 1px; text-transform: uppercase; }
  .header-sub { font-size: 8.5pt; color: #888; margin-top: 3px; font-style: italic; }

  /* Título */
  .cert-title { text-align: center; margin-bottom: 24px; }
  .cert-title h2 {
    font-size: 20pt; font-weight: 900; letter-spacing: 5px;
    text-transform: uppercase; color: #111;
  }
  .cert-title .divider {
    display: flex; align-items: center; gap: 10px;
    margin: 8px auto; max-width: 320px;
  }
  .cert-title .divider-line { flex: 1; height: 1px; background: ${accentColor}66; }
  .cert-title .divider-diamond {
    width: 8px; height: 8px; background: ${accentColor};
    transform: rotate(45deg); flex-shrink: 0;
  }
  .cert-title .year-badge {
    display: inline-block; background: ${accentColor}; color: white;
    font-size: 13pt; font-weight: 700; padding: 5px 28px;
    border-radius: 4px; letter-spacing: 3px;
  }

  /* Secção do membro */
  .member-section {
    display: flex; align-items: center; gap: 24px;
    padding: 18px 22px;
    background: ${accentColor}08;
    border: 1.5px solid ${accentColor}33;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  .member-photo {
    width: 88px; height: 88px; border-radius: 50%;
    object-fit: cover; border: 3px solid ${accentColor};
    flex-shrink: 0;
  }
  .member-photo-placeholder {
    width: 88px; height: 88px; border-radius: 50%; flex-shrink: 0;
    background: ${accentColor}1a; border: 3px solid ${accentColor}55;
    display: flex; align-items: center; justify-content: center;
    font-size: 34pt; font-weight: 900; color: ${accentColor};
  }
  .certify-text { font-size: 9pt; color: #888; margin-bottom: 4px; }
  .member-name { font-size: 19pt; font-weight: 900; color: #111; line-height: 1.1; }
  .member-nickname { font-size: 12pt; color: ${accentColor}; font-style: italic; margin-top: 2px; }
  .member-meta { font-size: 8.5pt; color: #999; margin-top: 5px; }

  /* Texto central */
  .body-text {
    text-align: center; font-size: 10.5pt; color: #555;
    line-height: 1.75; margin-bottom: 20px; font-style: italic;
  }

  /* Stats */
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
  .stat-box {
    border: 1px solid ${accentColor}44; border-radius: 6px;
    padding: 12px 8px; text-align: center;
    background: white;
  }
  .stat-box-top { border-top: 3px solid ${accentColor}; }
  .stat-value { font-size: 24pt; font-weight: 900; color: ${accentColor}; line-height: 1; }
  .stat-label { font-size: 7.5pt; color: #999; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.4px; }

  /* Roles text */
  .roles-line {
    text-align: center; font-size: 8.5pt; color: #666;
    margin-bottom: 20px; padding: 6px 16px;
    background: #f8f8f8; border-radius: 4px;
  }
  .roles-label { font-weight: 700; color: #444; }

  /* Tabela de raids */
  .raids-label { font-size: 7.5pt; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 7px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { background: ${accentColor}; color: white; padding: 5px 10px; text-align: left; font-weight: 700; }
  td { padding: 5px 10px; border-bottom: 1px solid #f0f0f0; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #fafafa; }

  /* Footer */
  .footer { margin-top: auto; padding-top: 20px; border-top: 1px solid #e8e8e8; }
  .issue-date { text-align: center; font-size: 9pt; color: #777; margin-bottom: 22px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; }
  .sig-block { text-align: center; }
  .sig-line { border-top: 1.5px solid #555; padding-top: 7px; margin-top: 28px; }
  .sig-role { font-size: 8.5pt; font-weight: 700; color: #333; }
  .sig-club { font-size: 8pt; color: #999; margin-top: 2px; }

  /* Rodapé fixo */
  .watermark {
    position: fixed; bottom: 11mm; right: 12mm;
    font-size: 7pt; color: ${accentColor}55;
    font-style: italic; letter-spacing: 0.5px;
  }
</style>
</head>
<body>
<div class="border-outer"></div>
<div class="border-inner"></div>

<div class="page">

  <!-- CABEÇALHO -->
  <div class="header">
    ${resolvedLogoUrl
        ? `<img src="${resolvedLogoUrl}" class="header-logo" alt="Logo">`
        : '<div class="header-logo-placeholder"></div>'}
    <div class="header-center">
      <div class="header-club">${club.name}</div>
      <div class="header-sub">${club.motto ?? club.location ?? 'Moto Clube'}</div>
    </div>
    <div class="header-logo-placeholder"></div>
  </div>

  <!-- TÍTULO -->
  <div class="cert-title">
    <h2>Certificado de Membro</h2>
    <div class="divider">
      <div class="divider-line"></div>
      <div class="divider-diamond"></div>
      <div class="divider-line"></div>
    </div>
    <div class="year-badge">${year}</div>
  </div>

  <!-- MEMBRO -->
  <div class="member-section">
    ${resolvedPhotoUrl
        ? `<img src="${resolvedPhotoUrl}" class="member-photo" alt="${member.fullName}">`
        : `<div class="member-photo-placeholder">${initial}</div>`}
    <div>
      <div class="certify-text">Certifica-se que</div>
      <div class="member-name">${member.fullName}</div>
      ${member.nickname ? `<div class="member-nickname">"${member.nickname}"</div>` : ''}
      <div class="member-meta">
        ${member.memberNumber ? `Nº ${member.memberNumber} &nbsp;·&nbsp; ` : ''}Membro Activo
        ${memberSince ? ` &nbsp;·&nbsp; Membro desde ${memberSince}` : ''}
      </div>
    </div>
  </div>

  <!-- TEXTO -->
  <div class="body-text">
    participou activamente nas actividades do <strong>${club.name}</strong><br>
    durante o ano de <strong>${year}</strong>, demonstrando espírito de grupo,<br>
    companheirismo e cumprimento das regras de segurança em estrada.
  </div>

  <!-- STATS -->
  <div class="stats-grid">
    <div class="stat-box stat-box-top">
      <div class="stat-value">${totalRaids}</div>
      <div class="stat-label">Raids Realizados</div>
    </div>
    <div class="stat-box stat-box-top">
      <div class="stat-value">${totalKm > 0 ? totalKm.toLocaleString('pt-AO') : '—'}</div>
      <div class="stat-label">KM Percorridos</div>
    </div>
    <div class="stat-box stat-box-top">
      <div class="stat-value">${Object.keys(roleCounts).length}</div>
      <div class="stat-label">Funções Exercidas</div>
    </div>
  </div>

  ${rolesText !== '—' ? `
  <div class="roles-line">
    <span class="roles-label">Funções:</span> ${rolesText}
  </div>` : ''}

  ${participations.length > 0 ? `
  <!-- LISTA DE RAIDS -->
  <div style="margin-bottom:20px">
    <div class="raids-label">Raids Participados em ${year}</div>
    <table>
      <thead>
        <tr><th>Raid</th><th>Data</th><th>Rota</th><th>Função</th><th>KM</th></tr>
      </thead>
      <tbody>
        ${participations.map((p) => `
        <tr>
          <td><strong>${p.raid?.title ?? '—'}</strong></td>
          <td style="white-space:nowrap">${p.raid?.date ? (0, date_fns_1.format)(new Date(p.raid.date), 'dd/MM/yyyy') : '—'}</td>
          <td style="color:#666">${p.raid?.origin && p.raid?.destination ? `${p.raid.origin} → ${p.raid.destination}` : '—'}</td>
          <td>${getRoleLabel(p.role ?? 'MEMBER')}</td>
          <td>${p.raid?.estimatedKm ? `${p.raid.estimatedKm} km` : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- FOOTER -->
  <div class="footer">
    <div class="issue-date">Emitido em ${club.location ?? 'Angola'}, ${issueDate}</div>
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">
          <div class="sig-role">Presidente</div>
          <div class="sig-club">${club.name}</div>
        </div>
      </div>
      <div class="sig-block">
        <div class="sig-line">
          <div class="sig-role">Secretário</div>
          <div class="sig-club">${club.name}</div>
        </div>
      </div>
    </div>
  </div>

</div>

<div class="watermark">${club.acronym ?? club.name} · RaidManager · ${year}</div>
</body>
</html>`;
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await browser.close();
    return Buffer.from(pdf);
}
// ─────────────────────────────────────────────────────────────────────────────
// Relatório Anual do Clube
// ─────────────────────────────────────────────────────────────────────────────
async function generateAnnualReport(params) {
    const { club, year, raids, members, transactions } = params;
    const accentColor = club.accentColor ?? '#dc2626';
    const resolvedLogoUrl = (0, cloudinary_1.resolveImageForPuppeteer)(club.logoUrl);
    const completedRaids = raids.filter((r) => r.status === 'COMPLETED');
    const totalKm = Math.round(completedRaids.reduce((s, r) => s + (r.estimatedKm ?? 0), 0));
    const activeMembers = members.filter((m) => m.status === 'ACTIVE').length;
    const newThisYear = members.filter((m) => {
        const d = m.joinedAt ? new Date(m.joinedAt) : null;
        return d && d.getFullYear() === year;
    }).length;
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const byMonth = monthNames.map((name, i) => ({
        name,
        total: raids.filter((r) => new Date(r.date).getMonth() === i).length,
    }));
    const maxMonthCount = Math.max(...byMonth.map((m) => m.total), 1);
    const countMap = {};
    for (const r of raids) {
        for (const p of r.participants ?? []) {
            const name = p.member?.nickname ?? p.member?.fullName ?? '?';
            if (!countMap[p.memberId])
                countMap[p.memberId] = { name, count: 0 };
            countMap[p.memberId].count++;
        }
    }
    const topMembers = Object.values(countMap).sort((a, b) => b.count - a.count).slice(0, 10);
    const totalIncome = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const hasFinance = transactions.length > 0;
    const fmtKz = (v) => v.toLocaleString('pt-AO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' Kz';
    const issueDate = (0, date_fns_1.format)(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: locale_1.ptBR });
    const reportHtml = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 10pt; color: #1a1a1a; background: white; }
  .page { padding: 12mm 18mm 10mm 18mm; }
  .section { margin-bottom: 22px; break-inside: avoid; page-break-inside: avoid; }
  .pb { page-break-before: always; padding-top: 12mm; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }

  .cover { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 14mm 0 12mm; border-bottom: 4px solid ${accentColor}; margin-bottom: 22px; }
  .cover-logo { height: 68px; object-fit: contain; margin-bottom: 12px; }
  .cover-club { font-size: 21pt; font-weight: 900; color: ${accentColor}; letter-spacing: 1px; text-transform: uppercase; }
  .cover-motto { font-size: 9pt; color: #888; margin-top: 4px; font-style: italic; }
  .cover-report { margin-top: 18px; }
  .cover-report h1 { font-size: 15pt; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: #222; }
  .cover-year { display: inline-block; margin-top: 10px; background: ${accentColor}; color: white; font-size: 17pt; font-weight: 900; padding: 5px 34px; border-radius: 4px; letter-spacing: 4px; }

  .section-title { font-size: 10.5pt; font-weight: 700; color: white; background: ${accentColor}; padding: 5px 12px; border-radius: 4px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }

  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
  .metric { border: 1px solid #e8e8e8; border-top: 3px solid ${accentColor}; border-radius: 6px; padding: 12px 10px; text-align: center; }
  .metric-value { font-size: 20pt; font-weight: 900; color: ${accentColor}; line-height: 1; }
  .metric-label { font-size: 7.5pt; color: #999; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.4px; }

  .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .bar-month { font-size: 7.5pt; color: #999; width: 24px; text-align: right; flex-shrink: 0; }
  .bar-bg { flex: 1; height: 14px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; background: ${accentColor}; min-width: 2px; }
  .bar-num { font-size: 7.5pt; font-weight: 700; color: ${accentColor}; width: 16px; text-align: right; flex-shrink: 0; }

  .members-list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .member-row { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: #fafafa; border-radius: 5px; border: 1px solid #f0f0f0; }
  .member-rank { font-size: 10pt; width: 22px; flex-shrink: 0; text-align: center; }
  .member-bar-wrap { flex: 1; }
  .member-name { font-size: 8.5pt; font-weight: 600; color: #222; margin-bottom: 3px; }
  .member-bar-bg { height: 4px; background: #eee; border-radius: 2px; overflow: hidden; }
  .member-bar-fill { height: 100%; border-radius: 2px; background: ${accentColor}; }
  .member-count { font-size: 8pt; font-weight: 700; color: ${accentColor}; flex-shrink: 0; }

  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { background: ${accentColor}; color: white; font-weight: 700; padding: 5px 10px; text-align: left; }
  td { padding: 5px 10px; border-bottom: 1px solid #f0f0f0; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #fafafa; }

  .finance-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .fin-card { border-radius: 6px; padding: 14px 12px; text-align: center; }
  .fin-income  { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .fin-expense { background: #fef2f2; border: 1px solid #fecaca; }
  .fin-balance { background: ${accentColor}08; border: 1px solid ${accentColor}33; }
  .fin-value { font-size: 14pt; font-weight: 900; margin-bottom: 3px; }
  .fin-income  .fin-value { color: #16a34a; }
  .fin-expense .fin-value { color: #dc2626; }
  .fin-balance .fin-value { color: ${accentColor}; }
  .fin-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.4px; color: #999; }

  .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e8e8e8; display: flex; justify-content: space-between; font-size: 7.5pt; color: #aaa; }
</style>
</head>
<body>
<div class="page">

<div class="cover">
  ${resolvedLogoUrl ? `<img src="${resolvedLogoUrl}" class="cover-logo" alt="Logo">` : ''}
  <div class="cover-club">${club.name}</div>
  ${club.motto ? `<div class="cover-motto">${club.motto}</div>` : ''}
  <div class="cover-report">
    <h1>Relatório Anual</h1>
    <div class="cover-year">${year}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Resumo do Ano</div>
  <div class="metrics">
    <div class="metric"><div class="metric-value">${completedRaids.length}</div><div class="metric-label">Raids Realizados</div></div>
    <div class="metric"><div class="metric-value">${totalKm > 0 ? totalKm.toLocaleString('pt-AO') : '—'}</div><div class="metric-label">KM Percorridos</div></div>
    <div class="metric"><div class="metric-value">${activeMembers}</div><div class="metric-label">Membros Activos</div></div>
    <div class="metric"><div class="metric-value">${newThisYear > 0 ? `+${newThisYear}` : newThisYear}</div><div class="metric-label">Novos Membros</div></div>
  </div>
</div>

${raids.length > 0 ? `
<div class="section">
  <div class="section-title">Actividade Mensal — ${year}</div>
  ${byMonth.map((m) => `
  <div class="bar-row">
    <div class="bar-month">${m.name}</div>
    <div class="bar-bg"><div class="bar-fill" style="width:${m.total > 0 ? Math.round((m.total / maxMonthCount) * 100) : 0}%"></div></div>
    <div class="bar-num">${m.total > 0 ? m.total : ''}</div>
  </div>`).join('')}
</div>
` : ''}

${topMembers.length > 0 ? `
<div class="section">
  <div class="section-title">Pilotos mais Activos</div>
  <div class="members-list">
    ${topMembers.map((m, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        const maxC = topMembers[0]?.count ?? 1;
        return `
    <div class="member-row">
      <div class="member-rank">${medals[i] ?? `<span style="font-size:8pt;color:#999;font-weight:700">${i + 1}</span>`}</div>
      <div class="member-bar-wrap">
        <div class="member-name">${m.name}</div>
        <div class="member-bar-bg"><div class="member-bar-fill" style="width:${Math.round((m.count / maxC) * 100)}%"></div></div>
      </div>
      <div class="member-count">${m.count}</div>
    </div>`;
    }).join('')}
  </div>
</div>
` : ''}

${raids.length > 0 ? `
<div class="section pb">
  <div class="section-title">Raids ${year} — ${raids.length} no total</div>
  <table>
    <thead><tr><th>Raid</th><th>Data</th><th>Rota</th><th>Estado</th><th>KM</th><th>Part.</th></tr></thead>
    <tbody>
      ${raids.map((r) => `
      <tr>
        <td><strong>${r.title}</strong></td>
        <td style="white-space:nowrap">${(0, date_fns_1.format)(new Date(r.date), 'dd/MM/yyyy')}</td>
        <td style="color:#555;font-size:8pt">${r.origin} → ${r.destination}</td>
        <td style="font-size:8pt">${getRaidStatusLabel(r.status)}</td>
        <td>${r.estimatedKm ? `${r.estimatedKm} km` : '—'}</td>
        <td>${(r.participants ?? []).length}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>
` : `<p style="color:#999;font-size:9pt;text-align:center;padding:20px">Nenhum raid registado em ${year}.</p>`}

${hasFinance ? `
<div class="section">
  <div class="section-title">Resumo Financeiro — ${year}</div>
  <div class="finance-grid">
    <div class="fin-card fin-income"><div class="fin-value">${fmtKz(totalIncome)}</div><div class="fin-label">Total de Receitas</div></div>
    <div class="fin-card fin-expense"><div class="fin-value">${fmtKz(totalExpense)}</div><div class="fin-label">Total de Despesas</div></div>
    <div class="fin-card fin-balance"><div class="fin-value">${fmtKz(totalIncome - totalExpense)}</div><div class="fin-label">Saldo Líquido</div></div>
  </div>
</div>
` : ''}

<div class="footer">
  <span>${club.name} · Relatório Anual ${year}</span>
  <span>Emitido em ${issueDate}</span>
  <span>Rungundum</span>
</div>

</div>
</body>
</html>`;
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(reportHtml, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: '8mm', right: '0', bottom: '8mm', left: '0' },
    });
    await browser.close();
    return Buffer.from(pdf);
}
function getRaidStatusLabel(s) {
    return { DRAFT: 'Rascunho', CONFIRMED: 'Confirmado', IN_PROGRESS: 'Em Curso', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }[s] ?? s;
}
//# sourceMappingURL=pdf.js.map