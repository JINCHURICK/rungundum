"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateProgramImage = generateProgramImage;
exports.generateProgramPDF = generateProgramPDF;
const puppeteer_1 = __importDefault(require("puppeteer"));
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
const cloudinary_1 = require("./cloudinary");
// SVG icon paths (fill="#fff") keyed by route type
const ICON_PATH = {
    DEPARTURE: `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>`,
    ARRIVAL: `<polygon points="3 11 22 2 13 21 11 13 3 11"/>`,
    STOP: `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>`,
    TECH_STOP: `<path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>`,
    BREAKFAST: `<path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>`,
    LUNCH: `<path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>`,
    COFFEE: `<path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>`,
    FUEL: `<path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM18 10c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zM8 18v-4.5H6L10 6v5h2l-4 7z"/>`,
    OVERNIGHT: `<path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/>`,
    SCENIC: `<path d="M14 6l-1-2H5v17h2v-7h5l1 2h7V6h-6zm4 8h-4l-1-2H7V6h5l1 2h5v6z"/>`,
    BORDER: `<path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>`,
};
const SECTION_LABEL = {
    TECH_STOP: 'Paragens Obrigatórias',
    FUEL: 'Abastecimento',
    LUNCH: 'Paragem Obrigatória para Almoço',
    BREAKFAST: 'Pequeno Almoço',
    COFFEE: 'Pausa Café',
    SCENIC: 'Ponto Panorâmico',
    BORDER: 'Fronteira',
    OVERNIGHT: 'Pernoita',
};
function iconSvg(type) {
    const path = ICON_PATH[type] ?? ICON_PATH.STOP;
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px;fill:#ffffff;">${path}</svg>`;
}
function buildHtml(raid, club) {
    const accent = club.accentColor ?? '#c0392b';
    const dateStr = (0, date_fns_1.format)(new Date(raid.date), "dd 'DE' MMMM 'DE' yyyy", { locale: locale_1.pt }).toUpperCase();
    const points = raid.routePoints ?? [];
    // Logo: imagem do clube ou círculo de fallback com acrónimo
    const logoInner = club.logoUrl
        ? `<img src="${club.logoUrl}" alt="logo" style="width:100%;height:100%;object-fit:contain;border-radius:50%;display:block;" />`
        : `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.8px;line-height:1.3;text-align:center;">${club.name}</div>`;
    // Build schedule rows
    const scheduleRows = [];
    let prevSectionLabel = '';
    points.forEach((p) => {
        const sectionLabel = SECTION_LABEL[p.type];
        // Day badge
        if (p.dayOffset) {
            const dayDate = new Date(raid.date);
            dayDate.setDate(dayDate.getDate() + (parseInt(p.dayOffset) - 1));
            const dayDateStr = (0, date_fns_1.format)(dayDate, "dd 'de' MMMM 'de' yyyy", { locale: locale_1.pt });
            scheduleRows.push(`
        <div style="background:${accent};border-radius:8px;padding:7px 16px;display:flex;align-items:center;justify-content:space-between;">
          <div style="font-family:'Arial Black',Arial,sans-serif;font-size:15px;color:#fff;letter-spacing:3px;">&#9876; DIA ${p.dayOffset}</div>
          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9px;font-weight:400;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;">${dayDateStr}</div>
        </div>`);
        }
        // Section divider (only when section changes)
        if (sectionLabel && sectionLabel !== prevSectionLabel) {
            prevSectionLabel = sectionLabel;
            scheduleRows.push(`
        <div style="background:#1a1a1a;border-radius:8px;padding:6px 14px;display:flex;align-items:center;justify-content:center;gap:10px;">
          <div style="flex:1;height:0.8px;background:rgba(255,255,255,0.15);"></div>
          <span style="font-family:'Arial Black',Arial,sans-serif;font-size:11.5px;color:#ffffff;letter-spacing:3px;white-space:nowrap;">${sectionLabel}</span>
          <div style="flex:1;height:0.8px;background:rgba(255,255,255,0.15);"></div>
        </div>`);
        }
        else if (!sectionLabel) {
            prevSectionLabel = '';
        }
        // Time display
        const timeHtml = p.scheduledTime
            ? `<div style="font-family:'Arial Black',Arial,sans-serif;font-size:15px;color:${accent};line-height:1.1;text-align:center;letter-spacing:0.5px;">${p.scheduledTime.replace(':', 'H')}</div>`
            : '';
        scheduleRows.push(`
      <div style="display:flex;align-items:stretch;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);min-height:52px;border-left:3px solid ${accent};">
        <!-- Icon -->
        <div style="width:44px;min-width:44px;display:flex;align-items:center;justify-content:center;padding:7px 5px;">
          <div style="width:30px;height:30px;background:#1a1a1a;border-radius:7px;display:flex;align-items:center;justify-content:center;">
            ${iconSvg(p.type)}
          </div>
        </div>
        <!-- Time -->
        <div style="width:58px;min-width:58px;display:flex;align-items:center;justify-content:center;border-right:1px solid #efefef;padding:6px 3px;background:#fafafa;">
          ${timeHtml}
        </div>
        <!-- Content -->
        <div style="flex:1;padding:8px 11px;display:flex;flex-direction:column;justify-content:center;">
          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.5px;line-height:1.2;margin-bottom:2px;">${p.name}</div>
          ${p.notes ? `<div style="font-size:10.5px;color:#777;line-height:1.4;">${p.notes}</div>` : ''}
        </div>
      </div>`);
    });
    return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #c8c8c8;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 0;
    font-family: 'Segoe UI', Arial, 'Helvetica Neue', Helvetica, sans-serif;
  }
  .poster {
    width: 420px;
    background: #f2f2f2;
    overflow: hidden;
  }
</style>
</head>
<body>
<div class="poster">

  <!-- HEADER -->
  <div style="position:relative;height:168px;background:#111;overflow:hidden;display:flex;align-items:flex-end;padding:0 16px 18px 18px;">

    <!-- Layered gradient -->
    <div style="position:absolute;inset:0;background:linear-gradient(100deg,rgba(0,0,0,0.96) 30%,rgba(0,0,0,0.3) 75%,rgba(0,0,0,0.05) 100%),linear-gradient(180deg,#1e1e1e 0%,#0a0a0a 100%);"></div>

    <!-- Bottom accent stripe -->
    <div style="position:absolute;bottom:0;left:0;width:100%;height:4px;background:${accent};z-index:4;"></div>

    <!-- Background SVG scene: mountains + road + moto -->
    <svg style="position:absolute;right:0;bottom:4px;width:260px;height:164px;opacity:0.28;" viewBox="0 0 260 164" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3a5a7a"/>
          <stop offset="100%" stop-color="#6a8fa8"/>
        </linearGradient>
      </defs>
      <rect width="260" height="164" fill="url(#sky)"/>
      <polygon points="0,120 50,55 100,120" fill="#243444"/>
      <polygon points="60,120 130,35 200,120" fill="#2e4258"/>
      <polygon points="140,120 210,60 260,120" fill="#243444"/>
      <polygon points="60,164 200,164 174,118 86,118" fill="#2e2e2e"/>
      <line x1="130" y1="118" x2="130" y2="164" stroke="#fff" stroke-width="2.5" stroke-dasharray="7,6"/>
      <line x1="60" y1="164" x2="86" y2="118" stroke="#666" stroke-width="1.5"/>
      <line x1="200" y1="164" x2="174" y2="118" stroke="#666" stroke-width="1.5"/>
      <g transform="translate(78,93) scale(0.75)">
        <circle cx="20" cy="30" r="14" fill="none" stroke="#fff" stroke-width="4"/>
        <circle cx="80" cy="30" r="14" fill="none" stroke="#fff" stroke-width="4"/>
        <line x1="20" y1="16" x2="50" y2="2" stroke="#fff" stroke-width="3.5"/>
        <line x1="50" y1="2" x2="80" y2="16" stroke="#fff" stroke-width="3.5"/>
        <line x1="40" y1="16" x2="50" y2="2" stroke="#fff" stroke-width="3"/>
        <ellipse cx="55" cy="7" rx="14" ry="5" fill="#fff"/>
        <line x1="76" y1="4" x2="90" y2="9" stroke="#fff" stroke-width="3"/>
        <ellipse cx="52" cy="-7" rx="8" ry="8" fill="#fff"/>
        <line x1="52" y1="1" x2="52" y2="13" stroke="#fff" stroke-width="4"/>
        <line x1="52" y1="5" x2="63" y2="9" stroke="#fff" stroke-width="3"/>
        <line x1="52" y1="13" x2="44" y2="24" stroke="#fff" stroke-width="3"/>
        <line x1="52" y1="13" x2="61" y2="24" stroke="#fff" stroke-width="3"/>
        <rect x="5" y="10" width="14" height="12" rx="2" fill="#fff"/>
        <rect x="81" y="10" width="14" height="12" rx="2" fill="#fff"/>
      </g>
    </svg>

    <!-- Logo circle (top right) -->
    <div style="position:absolute;top:14px;right:16px;z-index:5;width:84px;height:84px;border-radius:50%;background:${accent};border:2.5px solid #fff;outline:1.5px solid rgba(255,255,255,0.3);outline-offset:3px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
      ${logoInner}
    </div>

    <!-- Title content -->
    <div style="position:relative;z-index:3;flex:1;">
      <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:400;color:rgba(255,255,255,0.7);letter-spacing:4px;text-transform:uppercase;line-height:1;margin-bottom:1px;">Programa de</div>
      <div style="font-family:'Arial Black',Arial,sans-serif;font-size:56px;line-height:0.9;color:#ffffff;letter-spacing:2px;">VIAGEM</div>
      <div style="display:inline-block;background:${accent};color:#fff;font-family:'Arial Black',Arial,sans-serif;font-size:16px;letter-spacing:2px;padding:4px 13px 2px;border-radius:6px;margin-top:8px;">${dateStr}</div>
    </div>
  </div>

  <!-- SCHEDULE -->
  <div style="background:#ebebeb;padding:10px 10px 12px;display:flex;flex-direction:column;gap:5px;">
    ${scheduleRows.join('\n')}
  </div>

  <!-- FOOTER -->
  <div style="background:#111;padding:11px 16px;display:flex;align-items:center;justify-content:center;gap:12px;position:relative;">
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${accent};"></div>
    <span style="color:${accent};font-size:12px;line-height:1;">&#9733;</span>
    <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9px;font-weight:500;color:#fff;text-transform:uppercase;letter-spacing:3px;text-align:center;">${club.motto ?? 'Sempre na Estrada'}</div>
    <span style="color:${accent};font-size:12px;line-height:1;">&#9733;</span>
  </div>

</div>
</body>
</html>`;
}
async function launchAndRender(html) {
    const browser = await puppeteer_1.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 800, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return { browser, page };
}
async function generateProgramImage(raid, club) {
    const resolvedLogoUrl = (0, cloudinary_1.resolveImageForPuppeteer)(club.logoUrl);
    club = { ...club, logoUrl: resolvedLogoUrl };
    const html = buildHtml(raid, club);
    const { browser, page } = await launchAndRender(html);
    try {
        const screenshot = await page.screenshot({ type: 'png', fullPage: true, omitBackground: false });
        return Buffer.from(screenshot);
    }
    finally {
        await browser.close();
    }
}
async function generateProgramPDF(raid, club) {
    const resolvedLogoUrl = (0, cloudinary_1.resolveImageForPuppeteer)(club.logoUrl);
    club = { ...club, logoUrl: resolvedLogoUrl };
    const html = buildHtml(raid, club);
    const { browser, page } = await launchAndRender(html);
    try {
        // Calcula altura real do poster para definir a página exacta
        const height = await page.evaluate('document.body.scrollHeight');
        const pdf = await page.pdf({
            width: '420px',
            height: `${height}px`,
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });
        return Buffer.from(pdf);
    }
    finally {
        await browser.close();
    }
}
//# sourceMappingURL=programImage.js.map