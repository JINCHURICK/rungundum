"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSms = sendSms;
exports.sendBulkSms = sendBulkSms;
exports.sendQuotaReminderSms = sendQuotaReminderSms;
exports.sendQuotaPaidSms = sendQuotaPaidSms;
exports.sendSuspensionSms = sendSuspensionSms;
exports.sendSuspensionLiftedSms = sendSuspensionLiftedSms;
exports.sendFineSms = sendFineSms;
exports.sendRaidConfirmedSms = sendRaidConfirmedSms;
const axios_1 = __importDefault(require("axios"));
const TELCO_API_KEY = process.env.TELCO_API_KEY;
const TELCO_URL = 'https://www.telcosms.co.ao/api/v2/send_message';
function formatPhone(phone) {
    let n = phone.replace(/[\s\-\(\)\+]/g, '');
    // Remove prefixo 244 → formato local Angola (9XXXXXXXX)
    if (n.startsWith('244') && n.length === 12)
        return n.slice(3);
    // Remove zero inicial
    if (n.startsWith('0'))
        return n.slice(1);
    return n;
}
async function send(phones, message) {
    if (!TELCO_API_KEY) {
        console.log(`[SMS dev] to=${phones.join(',')} msg="${message}"`);
        return;
    }
    for (const phone of phones) {
        const number = formatPhone(phone);
        try {
            await axios_1.default.post(TELCO_URL, {
                message: {
                    api_key_app: TELCO_API_KEY,
                    phone_number: number,
                    message_body: message,
                    sender_name: 'RUNGUNDUM',
                },
            }, {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log(`[SMS] Enviado para ${number}`);
        }
        catch (err) {
            const data = err.response?.data;
            console.error(`[SMS error] ${number}: ${data ? JSON.stringify(data) : err.message}`);
        }
    }
}
// ── funções públicas ─────────────────────────────────────────────────────────
async function sendSms(phone, message) {
    return send([phone], message);
}
async function sendBulkSms(phones, message) {
    if (phones.length === 0)
        return;
    return send(phones, message);
}
async function sendQuotaReminderSms(p) {
    const m = p.monthsOverdue ?? 1;
    const meses = m === 1 ? '1 mes' : `${m} meses`;
    const valor = (p.monthlyAmount * m).toLocaleString();
    const level = p.level ?? 1;
    let msg;
    switch (level) {
        case 1:
            msg = `${p.clubName} | Ola ${p.memberName}! Notamos que tens ${meses} de quota de ${p.year} por regularizar (${valor} Kz). Se ja trataste, ignora. Boa estrada!`;
            break;
        case 2:
            msg = `${p.clubName} | ${p.memberName}, tens ${meses} de quota de ${p.year} em atraso (${valor} Kz). Por favor regulariza o mais breve possivel. Contacta o tesoureiro.`;
            break;
        case 3:
            msg = `${p.clubName} | ${p.memberName}, tens ${meses} de quota de ${p.year} em atraso. A direccao solicita justificacao formal em 10 dias. O nao cumprimento pode resultar em suspensao.`;
            break;
        case 4:
            msg = `${p.clubName} | ${p.memberName}, tens ${meses} de quota de ${p.year} por pagar. A direccao deliberou risco de suspensao e remocao. Regulariza urgentemente.`;
            break;
        default:
            msg = `${p.clubName}: Ola ${p.memberName}, tens quotas de ${p.year} por pagar (${p.monthlyAmount.toLocaleString()} Kz/mes). Contacta o administrador.`;
    }
    await send([p.phone], msg);
}
async function sendQuotaPaidSms(p) {
    const meses = p.monthsPaid === 1 ? '1 mes' : `${p.monthsPaid} meses`;
    await send([p.phone], `${p.clubName} | Ola ${p.memberName}! O teu pagamento de quota foi confirmado: ${meses} de ${p.year} - ${p.amount.toLocaleString()} Kz. Obrigado pela pontualidade. Boa estrada!`);
}
async function sendSuspensionSms(p) {
    await send([p.phone], `${p.clubName} | ${p.memberName}, foste suspenso de ${p.startDate} ate ${p.endDate}. Motivo: ${p.reason}. Para esclarecimentos contacta a direccao do clube. - Rungundum`);
}
async function sendSuspensionLiftedSms(p) {
    await send([p.phone], `${p.clubName} | ${p.memberName}, a tua suspensao foi levantada. A tua situacao esta regularizada. Bem-vindo de volta! - Rungundum`);
}
async function sendFineSms(p) {
    await send([p.phone], `${p.clubName} | ${p.memberName}, foi-te aplicada uma multa de ${p.amount.toLocaleString()} Kz. Motivo: ${p.reason}. Regulariza com o tesoureiro o mais breve possivel. - Rungundum`);
}
async function sendRaidConfirmedSms(p) {
    await send([p.phone], `${p.clubName} | ${p.memberName}, o raid "${p.raidTitle}" esta confirmado para ${p.raidDate}! Confirma a tua presenca na app. Boa estrada! - Rungundum`);
}
//# sourceMappingURL=sms.js.map