"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTwoFactorCode = sendTwoFactorCode;
exports.sendPasswordReset = sendPasswordReset;
exports.sendAccountInvite = sendAccountInvite;
exports.sendRaidPublished = sendRaidPublished;
exports.sendEmailVerification = sendEmailVerification;
exports.sendQuotaReminder = sendQuotaReminder;
exports.sendQuotaPaid = sendQuotaPaid;
exports.sendTrialExpiring = sendTrialExpiring;
exports.sendQuotaAlertEmail = sendQuotaAlertEmail;
exports.sendUpgradeRequest = sendUpgradeRequest;
exports.sendPaymentProofReceived = sendPaymentProofReceived;
exports.sendSubscriptionApproved = sendSubscriptionApproved;
exports.sendSubscriptionRejected = sendSubscriptionRejected;
exports.sendFineEmail = sendFineEmail;
exports.sendSuspensionEmail = sendSuspensionEmail;
exports.sendRaidInvite = sendRaidInvite;
exports.sendWelcomeEmail = sendWelcomeEmail;
exports.sendAnnouncementEmail = sendAnnouncementEmail;
exports.sendRaidReminder = sendRaidReminder;
const nodemailer_1 = __importDefault(require("nodemailer"));
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '465', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM = SMTP_USER ? `Rungundum <${SMTP_USER}>` : 'Rungundum <noreply@rungundum.com>';
const transporter = SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer_1.default.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
    })
    : null;
async function send(payload) {
    if (!transporter) {
        console.log(`[Email dev] to=${payload.to} subject="${payload.subject}"`);
        return;
    }
    try {
        await transporter.sendMail({ from: FROM, ...payload });
    }
    catch (err) {
        // Falha de email não deve crashar o servidor — logar e continuar
        console.error(`[Email error] to=${payload.to} subject="${payload.subject}" erro: ${err.message}`);
    }
}
async function sendTwoFactorCode(params) {
    const clubName = escapeHtml(params.clubName);
    await send({
        to: params.to,
        subject: `[${clubName}] Código de verificação: ${params.code}`,
        html: `
      <h2>Verificação de acesso — ${clubName}</h2>
      <p>O teu código de verificação é:</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#dc2626;margin:24px 0;font-family:monospace">${params.code}</div>
      <p style="color:#666;font-size:14px">Válido por 10 minutos. Se não foste tu, ignora este email.</p>
      <p style="color:#666;font-size:14px">${clubName} · Rungundum</p>
    `,
    });
}
async function sendPasswordReset(params) {
    const clubName = escapeHtml(params.clubName);
    await send({
        to: params.to,
        subject: `[${clubName}] Recuperação de senha`,
        html: `
      <h2>Recuperação de senha</h2>
      <p>Recebemos um pedido de recuperação de senha para a tua conta no <strong>${clubName}</strong>.</p>
      <a href="${params.resetUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Definir nova senha →
      </a>
      <p style="color:#666;font-size:14px">O link expira em 1 hora. Se não pediste esta recuperação, ignora este email.</p>
      <p style="color:#666;font-size:14px">${clubName} · Rungundum</p>
    `,
    });
}
async function sendAccountInvite(params) {
    const clubName = escapeHtml(params.clubName);
    const memberName = escapeHtml(params.memberName);
    await send({
        to: params.to,
        subject: `[${clubName}] Convite para o Rungundum`,
        html: `
      <h2>Olá ${memberName},</h2>
      <p>Foste convidado para aceder ao sistema de gestão de raids do <strong>${clubName}</strong>.</p>
      <p>Clica no botão abaixo para criar a tua conta. O link é válido por 48 horas.</p>
      <a href="${params.inviteUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Criar a minha conta →
      </a>
      <p style="color:#666;font-size:12px">Se não esperavas este email, podes ignorá-lo.</p>
      <p style="color:#666;font-size:14px">${clubName} · Rungundum</p>
    `,
    });
}
async function sendRaidPublished(params) {
    const clubName = escapeHtml(params.clubName);
    const memberName = escapeHtml(params.memberName);
    const raidTitle = escapeHtml(params.raidTitle);
    const raidDate = escapeHtml(params.raidDate);
    await send({
        to: params.to,
        subject: `[${clubName}] Raid "${raidTitle}" confirmado — ${raidDate}`,
        html: `
      <h2>Olá ${memberName},</h2>
      <p>O raid <strong>${raidTitle}</strong> foi confirmado para <strong>${raidDate}</strong>.</p>
      <a href="${params.publicUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Ver detalhes do raid →
      </a>
      <p style="color:#666;font-size:14px">${clubName} · Rungundum</p>
    `,
    });
}
async function sendEmailVerification(params) {
    const clubName = escapeHtml(params.clubName);
    await send({
        to: params.to,
        subject: `[${clubName}] Confirma o teu endereço de email`,
        html: `
      <h2>Bem-vindo ao ${clubName}!</h2>
      <p>Para activar a tua conta no Rungundum, confirma o teu endereço de email clicando no botão abaixo.</p>
      <a href="${params.verifyUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Verificar email →
      </a>
      <p style="color:#666;font-size:14px">O link expira em 24 horas.</p>
      <p style="color:#666;font-size:14px">Se não criaste esta conta, ignora este email.</p>
      <p style="color:#666;font-size:14px">${clubName} · Rungundum</p>
    `,
    });
}
async function sendQuotaReminder(params) {
    const clubName = escapeHtml(params.clubName);
    const memberName = escapeHtml(params.memberName);
    await send({
        to: params.to,
        subject: `[${clubName}] Lembrete: Quota anual ${params.year} — ${params.amount}Kz`,
        html: `
      <h2>Olá ${memberName},</h2>
      <p>A tua quota anual <strong>${params.year}</strong> do <strong>${clubName}</strong> no valor de <strong>${params.amount}Kz</strong> ainda não foi paga.</p>
      <p>Por favor, efectua o pagamento e contacta o administrador para confirmar.</p>
      <a href="${params.appUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Ver no Rungundum →
      </a>
      <p style="color:#666;font-size:14px">${clubName} · Rungundum</p>
    `,
    });
}
async function sendQuotaPaid(params) {
    const clubName = escapeHtml(params.clubName);
    const memberName = escapeHtml(params.memberName);
    await send({
        to: params.to,
        subject: `[${clubName}] Quota ${params.year} confirmada — ${params.amount}Kz`,
        html: `
      <h2>Olá ${memberName},</h2>
      <p>O pagamento da tua quota anual <strong>${params.year}</strong> no valor de <strong>${params.amount}Kz</strong> foi confirmado pelo administrador do <strong>${clubName}</strong>.</p>
      <p style="color:#16a34a;font-size:18px;font-weight:bold">✓ Quota paga</p>
      <p style="color:#666;font-size:14px">${clubName} · Rungundum</p>
    `,
    });
}
async function sendTrialExpiring(params) {
    const clubName = escapeHtml(params.clubName);
    await send({
        to: params.to,
        subject: `[Rungundum] O teu período de prova expira em ${params.daysLeft} dias`,
        html: `
      <h2>O período de prova do ${clubName} está a terminar</h2>
      <p>O teu período de prova gratuito do Rungundum expira em <strong>${params.daysLeft} dias</strong>.</p>
      <p>Para continuar a usar todas as funcionalidades, escolhe um plano.</p>
      <a href="${params.appUrl}/settings/subscription" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Ver planos disponíveis →
      </a>
      <p style="color:#666;font-size:14px">Rungundum</p>
    `,
    });
}
async function sendQuotaAlertEmail(params) {
    const name = escapeHtml(params.memberName);
    const club = escapeHtml(params.clubName);
    const { year, monthsOverdue: m, monthlyAmount, level } = params;
    const meses = m === 1 ? '1 mês' : `${m} meses`;
    const valorDev = (monthlyAmount * m).toLocaleString() + ' Kz';
    const subjects = [
        '',
        `[${club}] Lembrete de quota ${year}`,
        `[${club}] Alerta: quota ${year} em atraso`,
        `[${club}] Aviso disciplinar — quota ${year}`,
        `[${club}] URGENTE: risco de suspensão — quota ${year}`,
    ];
    const colors = ['', '#ca8a04', '#dc7800', '#dc2626', '#7f1d1d'];
    const badges = ['', '⚠️ Lembrete', '🚨 Em Atraso', '⚖️ Aviso Disciplinar', '🔴 Risco de Suspensão'];
    const bodies = {
        1: `<p>Olá ${name},</p>
        <p>Notámos que tens <strong>${meses} de quota de ${year}</strong> por regularizar (<strong>${valorDev}</strong>).</p>
        <p>Se já efectuaste o pagamento, ignora esta mensagem. Caso contrário, pede ao tesoureiro do clube para registar o teu pagamento.</p>
        <p>Obrigado pela colaboração. Boa estrada!</p>`,
        2: `<p>Olá ${name},</p>
        <p>Tens <strong>${meses} de quota de ${year}</strong> em atraso, num total de <strong>${valorDev}</strong>.</p>
        <p>Pedimos que regularizes a tua situação o mais breve possível. Para esclarecimentos ou dificuldades, contacta directamente o tesoureiro ou a direcção do clube.</p>`,
        3: `<p>Caro ${name},</p>
        <p>Acumulas <strong>${meses} de quota de ${year}</strong> em atraso (<strong>${valorDev}</strong>). A direcção do ${club} informa que foi aberto um processo disciplinar automático na tua ficha.</p>
        <p><strong>Tens 10 dias para apresentar justificação formal à direcção</strong>, seja por incapacidade financeira ou outra razão válida.</p>
        <p>O não cumprimento deste prazo pode resultar em <strong>suspensão temporária</strong> e impedimento de participação em raids e eventos do clube.</p>
        <p>Contacta urgentemente a direcção para resolver a tua situação.</p>`,
        4: `<p>Caro ${name},</p>
        <p>Acumulas <strong>${meses} de quota de ${year}</strong> em atraso (<strong>${valorDev}</strong>). Apesar dos avisos anteriores, a situação não foi regularizada.</p>
        <p style="color:#7f1d1d;font-weight:bold">A direcção do ${club} deliberou que corres risco de suspensão e eventual remoção do clube.</p>
        <p>Para evitar medidas drásticas, <strong>regulariza a tua situação imediatamente</strong> ou contacta a direcção para um acordo formal de pagamento.</p>`,
    };
    await send({
        to: params.to,
        subject: subjects[level] ?? subjects[1],
        html: `
      <div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#1f2937">
        <div style="background:${colors[level] ?? colors[1]};padding:16px 24px;border-radius:8px 8px 0 0">
          <span style="color:white;font-size:14px;font-weight:bold">${badges[level] ?? badges[1]}</span>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          ${bodies[level] ?? bodies[1]}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px">${club} · Rungundum — este é um alerta automático</p>
        </div>
      </div>
    `,
    });
}
async function sendUpgradeRequest(params) {
    const clubName = escapeHtml(params.clubName);
    const clubLocation = escapeHtml(params.clubLocation);
    const currentPlan = escapeHtml(params.currentPlan);
    const requestedPlan = escapeHtml(params.requestedPlan);
    const adminEmail = escapeHtml(params.clubAdminEmail);
    await send({
        to: params.to,
        subject: `[Rungundum] Pedido de upgrade — ${clubName}`,
        html: `
      <h2>Pedido de upgrade de plano</h2>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px;color:#666;font-size:14px">Clube</td><td style="padding:8px;font-weight:bold">${clubName} (${clubLocation})</td></tr>
        <tr><td style="padding:8px;color:#666;font-size:14px">Email do admin</td><td style="padding:8px">${adminEmail}</td></tr>
        <tr><td style="padding:8px;color:#666;font-size:14px">Plano actual</td><td style="padding:8px">${currentPlan}</td></tr>
        <tr><td style="padding:8px;color:#666;font-size:14px">Plano pedido</td><td style="padding:8px;font-weight:bold;color:#dc2626">${requestedPlan}</td></tr>
      </table>
      <a href="${params.adminUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Gerir subscrições →
      </a>
      <p style="color:#666;font-size:14px">Rungundum · Painel Administrativo</p>
    `,
    });
}
async function sendPaymentProofReceived(params) {
    const club = escapeHtml(params.clubName);
    const cycle = params.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal';
    await send({
        to: params.to,
        subject: `[Rungundum] Comprovante recebido — ${club} · Fatura ${params.invoiceNumber}`,
        html: `
      <div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#1f2937">
        <div style="background:#dc2626;padding:16px 24px;border-radius:8px 8px 0 0">
          <span style="color:white;font-size:15px;font-weight:bold">🧾 Comprovante de pagamento recebido</span>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px">Clube</td><td style="padding:6px 0;font-weight:600">${club}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Fatura</td><td style="padding:6px 0;font-weight:600">${params.invoiceNumber}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Plano</td><td style="padding:6px 0">${params.planCode} · ${cycle}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Valor</td><td style="padding:6px 0;font-weight:600;color:#dc2626">${params.amountKz.toLocaleString('pt-AO')} Kz</td></tr>
          </table>
          <p style="margin-bottom:16px">O comprovante de transferência bancária está disponível em:</p>
          <a href="${params.proofUrl}" style="color:#dc2626;word-break:break-all">Ver comprovante →</a>
          <br><br>
          <a href="${params.adminUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">
            Revisar no painel →
          </a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px">Rungundum · Painel Administrativo</p>
        </div>
      </div>
    `,
    });
}
async function sendSubscriptionApproved(params) {
    const club = escapeHtml(params.clubName);
    const expiry = params.newExpiry.toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' });
    await send({
        to: params.to,
        subject: `[Rungundum] Subscrição renovada — ${club}`,
        html: `
      <div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#1f2937">
        <div style="background:#16a34a;padding:16px 24px;border-radius:8px 8px 0 0">
          <span style="color:white;font-size:15px;font-weight:bold">✅ Subscrição activada</span>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p>Olá, equipa do <strong>${club}</strong>!</p>
          <p>O vosso pagamento foi confirmado e a subscrição foi activada.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px">Fatura</td><td style="padding:6px 0;font-weight:600">${params.invoiceNumber}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Plano</td><td style="padding:6px 0">${params.planCode}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Renovação</td><td style="padding:6px 0">${params.renewMonths} ${params.renewMonths === 1 ? 'mês' : 'meses'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Válido até</td><td style="padding:6px 0;font-weight:600;color:#16a34a">${expiry}</td></tr>
          </table>
          <a href="${params.clientUrl}/dashboard" style="background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">
            Aceder ao sistema →
          </a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px">Rungundum · Obrigado pela vossa confiança!</p>
        </div>
      </div>
    `,
    });
}
async function sendSubscriptionRejected(params) {
    const club = escapeHtml(params.clubName);
    const notes = escapeHtml(params.reviewNotes);
    await send({
        to: params.to,
        subject: `[Rungundum] Pagamento não confirmado — Fatura ${params.invoiceNumber}`,
        html: `
      <div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#1f2937">
        <div style="background:#ca8a04;padding:16px 24px;border-radius:8px 8px 0 0">
          <span style="color:white;font-size:15px;font-weight:bold">⚠️ Pagamento não confirmado</span>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p>Olá, equipa do <strong>${club}</strong>.</p>
          <p>Não conseguimos confirmar o pagamento referente à fatura <strong>${params.invoiceNumber}</strong>.</p>
          ${notes ? `<p><strong>Motivo:</strong> ${notes}</p>` : ''}
          <p>Por favor, verifica se a transferência foi efectuada correctamente e submete um novo comprovante.</p>
          <a href="${params.clientUrl}/subscription/pay" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">
            Submeter novo comprovante →
          </a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px">Rungundum · Para dúvidas, contacta o suporte.</p>
        </div>
      </div>
    `,
    });
}
async function sendFineEmail(params) {
    const club = escapeHtml(params.clubName);
    const member = escapeHtml(params.memberName);
    const reason = escapeHtml(params.reason);
    const notes = params.notes ? escapeHtml(params.notes) : null;
    await send({
        to: params.to,
        subject: `[${club}] Multa aplicada — ${params.amount.toLocaleString('pt-AO')} Kz`,
        html: `
      <div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#1f2937">
        <div style="background:#dc2626;padding:16px 24px;border-radius:8px 8px 0 0">
          <span style="color:white;font-size:15px;font-weight:bold">⚖️ Notificação de multa</span>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p>Olá <strong>${member}</strong>,</p>
          <p>A direcção do <strong>${club}</strong> informa que te foi aplicada uma multa.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;background:#fef2f2;border-radius:8px">
            <tr><td style="padding:10px 14px;color:#6b7280;font-size:14px;width:130px">Valor</td><td style="padding:10px 14px;font-weight:700;font-size:18px;color:#dc2626">${params.amount.toLocaleString('pt-AO')} Kz</td></tr>
            <tr><td style="padding:10px 14px;color:#6b7280;font-size:14px;border-top:1px solid #fee2e2">Motivo</td><td style="padding:10px 14px;border-top:1px solid #fee2e2">${reason}</td></tr>
            ${notes ? `<tr><td style="padding:10px 14px;color:#6b7280;font-size:14px;border-top:1px solid #fee2e2">Observações</td><td style="padding:10px 14px;border-top:1px solid #fee2e2">${notes}</td></tr>` : ''}
          </table>
          <p>Por favor, regulariza este valor junto do tesoureiro do clube o mais breve possível.</p>
          <p>Para esclarecimentos ou contestação, contacta a direcção do ${club}.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px">${club} · Rungundum — este é um aviso automático</p>
        </div>
      </div>
    `,
    });
}
async function sendSuspensionEmail(params) {
    const club = escapeHtml(params.clubName);
    const member = escapeHtml(params.memberName);
    const reason = escapeHtml(params.reason);
    const notes = params.notes ? escapeHtml(params.notes) : null;
    await send({
        to: params.to,
        subject: `[${club}] Suspensão aplicada`,
        html: `
      <div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#1f2937">
        <div style="background:#7f1d1d;padding:16px 24px;border-radius:8px 8px 0 0">
          <span style="color:white;font-size:15px;font-weight:bold">🚫 Notificação de suspensão</span>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p>Caro(a) <strong>${member}</strong>,</p>
          <p>A direcção do <strong>${club}</strong> informa que foste suspenso(a) por decisão disciplinar.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;background:#fef2f2;border-radius:8px">
            <tr><td style="padding:10px 14px;color:#6b7280;font-size:14px;width:130px">Período</td><td style="padding:10px 14px;font-weight:600">${params.startDate} — ${params.endDate}</td></tr>
            <tr><td style="padding:10px 14px;color:#6b7280;font-size:14px;border-top:1px solid #fee2e2">Motivo</td><td style="padding:10px 14px;border-top:1px solid #fee2e2">${reason}</td></tr>
            ${notes ? `<tr><td style="padding:10px 14px;color:#6b7280;font-size:14px;border-top:1px solid #fee2e2">Observações</td><td style="padding:10px 14px;border-top:1px solid #fee2e2">${notes}</td></tr>` : ''}
          </table>
          <p>Durante o período de suspensão, o acesso ao sistema e a participação em raids e eventos do clube estará impedida.</p>
          <p>Para esclarecimentos ou contestação desta decisão, contacta directamente a direcção do ${club}.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px">${club} · Rungundum — este é um aviso automático</p>
        </div>
      </div>
    `,
    });
}
async function sendRaidInvite(params) {
    const clubName = escapeHtml(params.clubName);
    const memberName = escapeHtml(params.memberName);
    const raidTitle = escapeHtml(params.raidTitle);
    const raidDate = escapeHtml(params.raidDate);
    await send({
        to: params.to,
        subject: `[${clubName}] Raid ${raidTitle} — Confirma a tua presença`,
        html: `
      <h2>Olá ${memberName},</h2>
      <p>O raid <strong>${raidTitle}</strong> está confirmado para <strong>${raidDate}</strong>.</p>
      <p>Confirma a tua presença clicando no botão abaixo:</p>
      <a href="${params.confirmUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Confirmar Presença →
      </a>
      <p style="color:#666;font-size:14px">${clubName} · Rungundum</p>
    `,
    });
}
async function sendWelcomeEmail(params) {
    const clubName = escapeHtml(params.clubName);
    const memberName = escapeHtml(params.memberName);
    await send({
        to: params.to,
        subject: `Bem-vindo ao ${clubName}! — Activa a tua conta`,
        html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
        <div style="background:#dc2626;padding:24px 28px;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px">Bem-vindo ao ${clubName}!</h1>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:28px;border-radius:0 0 8px 8px">
          <p style="font-size:15px;color:#1a2035">Olá <strong>${memberName}</strong>,</p>
          <p style="font-size:14px;color:#4b5563">A tua conta no Rungundum foi criada pelo administrador do clube. Guarda as tuas credenciais de acesso e clica no botão abaixo para activar a conta.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px">
            <tr>
              <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;width:40%">Email</td>
              <td style="padding:12px 16px;font-size:13px;color:#1a2035;border-bottom:1px solid #e5e7eb;font-family:monospace">${escapeHtml(params.to)}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280">Password provisória</td>
              <td style="padding:12px 16px;font-size:13px;color:#1a2035;font-family:monospace">${escapeHtml(params.password)}</td>
            </tr>
          </table>
          <p style="font-size:14px;color:#1a2035;font-weight:600;margin-bottom:8px">Passo 1 — Confirma o teu email</p>
          <p style="font-size:13px;color:#4b5563;margin-bottom:12px">Clica no botão abaixo para confirmar o teu endereço de email e activar o acesso. O link expira em 24 horas.</p>
          <a href="${params.verifyUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-bottom:20px;font-size:14px;font-weight:600">
            Confirmar email e activar conta →
          </a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="font-size:13px;color:#6b7280;margin-bottom:4px"><strong>Passo 2</strong> — Após confirmar, entra com o email e a password acima.</p>
          <p style="font-size:12px;color:#9ca3af;margin-top:16px">Por segurança, altera a tua password após o primeiro acesso em <em>Conta → Alterar Password</em>.</p>
          <p style="font-size:12px;color:#9ca3af;margin-top:4px">${clubName} · Rungundum</p>
        </div>
      </div>
    `,
    });
}
async function sendAnnouncementEmail(params) {
    const club = escapeHtml(params.clubName);
    const member = escapeHtml(params.memberName);
    const title = escapeHtml(params.title);
    const body = params.body.split('\n').map(escapeHtml).join('<br>');
    await send({
        to: params.to,
        subject: `[${club}] ${params.title}`,
        html: `
      <div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#1f2937">
        <div style="background:#dc2626;padding:16px 24px;border-radius:8px 8px 0 0">
          <span style="color:white;font-size:15px;font-weight:bold">📢 ${title}</span>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p>Olá <strong>${member}</strong>,</p>
          <div style="background:#f9fafb;border-left:4px solid #dc2626;padding:16px;border-radius:0 6px 6px 0;margin:16px 0;line-height:1.6">${body}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px">${club} · Rungundum</p>
        </div>
      </div>
    `,
    });
}
async function sendRaidReminder(params) {
    const clubName = escapeHtml(params.clubName);
    const memberName = escapeHtml(params.memberName);
    const raidTitle = escapeHtml(params.raidTitle);
    const raidDate = escapeHtml(params.raidDate);
    await send({
        to: params.to,
        subject: `[${clubName}] Lembrete: Raid ${raidTitle} — Confirmação pendente`,
        html: `
      <h2>Olá ${memberName},</h2>
      <p>Ainda não confirmaste a tua presença no raid <strong>${raidTitle}</strong> de <strong>${raidDate}</strong>.</p>
      <a href="${params.confirmUrl}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Confirmar Presença →
      </a>
      <p style="color:#666;font-size:14px">${clubName} · Rungundum</p>
    `,
    });
}
//# sourceMappingURL=email.js.map