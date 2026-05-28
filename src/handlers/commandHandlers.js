const { addDebt, settleDebt } = require('../services/debtService'); // DODATO settleDebt
const { getBalances } = require('../services/walletService');
const { moveMoney } = require('../services/transferService');
const { LOCATION_ALIASES } = require('../utils/constants');
const { Markup } = require('telegraf'); // DODATO za dugmiće
const supabase = require('../db/supabase');
const { getMonthlyReport } = require('../services/reportService');

// Komanda /stanje - Pregled svih novčanika
async function handleStanje(ctx) {
    try {
        const balances = await getBalances();
        if (!balances || balances.length === 0) return ctx.reply('Novčanici su prazni.');

        const grouped = balances.reduce((acc, curr) => {
            if (!acc[curr.location]) acc[curr.location] = [];
            acc[curr.location].push(`${curr.balance} ${curr.currency}`);
            return acc;
        }, {});

        let message = '📊 *TVOJE TRENUTNO STANJE*\n\n';
        for (const [location, amounts] of Object.entries(grouped)) {
            message += `📍 *${location}*\n${amounts.map(amt => `  • ${amt}`).join('\n')}\n\n`;
        }
        await ctx.replyWithMarkdown(message);
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Greška pri učitavanju stanja.');
    }
}

// Komanda /prebaci - Transfer između lokacija
async function handleTransfer(ctx) {
    const text = ctx.message.text.replace('/prebaci', '').trim().toLowerCase();
    const match = text.match(/iz\s+(.*?)\s+u\s+(.*?)\s+(\d+(?:\.\d+)?)\s*(rsd|eur|bam)/);

    if (!match) return ctx.reply('Format: /prebaci iz [lokacija] u [lokacija] [iznos] [valuta]');

    const fromLoc = LOCATION_ALIASES[match[1].trim()];
    const toLoc = LOCATION_ALIASES[match[2].trim()];
    const amount = parseFloat(match[3]);
    const currency = match[4].toUpperCase();

    if (!fromLoc || !toLoc) return ctx.reply('Ne prepoznajem lokaciju.');

    try {
        await moveMoney(fromLoc, currency, toLoc, currency, amount);
        ctx.reply(`✅ Preneto: ${amount} ${currency}\n${fromLoc} ➔ ${toLoc}`);
    } catch (error) {
        ctx.reply('❌ Greška pri transferu.');
    }
}

// Komanda /dugovi - Pregled svih aktivnih dugova i potraživanja
async function handleDugovi(ctx) {
    try {
        const { data: debts, error } = await supabase.from('debts').select('*').eq('status', 'ACTIVE');
        if (error) throw error;
        if (!debts || debts.length === 0) return ctx.reply('Nemaš aktivnih dugova.');

        let potrazivanja = '💰 *DRUGI DUGUJU TEBI:*\n';
        let dugovanja = '📉 *TI DUGUJEŠ:*\n';

        debts.forEach(d => {
            const line = `• *${d.counterparty}*: ${d.original_amount} ${d.currency} _(${d.description || ''})_\n`;
            if (d.direction === 'OWED_TO_ME') potrazivanja += line;
            else dugovanja += line;
        });

        await ctx.replyWithMarkdown(`${potrazivanja}\n${dugovanja}`);
    } catch (error) {
        ctx.reply('❌ Greška pri učitavanju dugova.');
    }
}

// Komanda /dug - Unos duga (npr. /dug Faks -6000 rsd ispiti)
async function handleDug(ctx) {
    const text = ctx.message.text.replace('/dug', '').trim();
    const match = text.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)\s*(rsd|eur|bam)\s*(.*)$/i);

    if (!match) return ctx.reply('Format: `/dug Željko 1100 eur Sajt`');

    const [_, person, amountStr, currency, desc] = match;
    const amount = parseFloat(amountStr);
    const direction = amount < 0 ? 'I_OWE' : 'OWED_TO_ME';

    try {
        await addDebt(ctx.from.id, person, amount, currency.toUpperCase(), desc, direction);
        ctx.reply(`✅ Zapisano: ${person} | ${Math.abs(amount)} ${currency.toUpperCase()}`);
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Greška pri upisu duga.');
    }
}

// Komanda /isplati - Izbacuje dugmiće za zatvaranje dugova
async function handleIsplati(ctx) {
    try {
        const { data: debts, error } = await supabase
            .from('debts')
            .select('*')
            .eq('status', 'ACTIVE');

        if (error) throw error;
        if (!debts || debts.length === 0) return ctx.reply('Nemaš aktivnih dugova za isplatu.');

        const buttons = debts.map(d => {
            const label = `${d.direction === 'I_OWE' ? '🔴' : '🟢'} ${d.counterparty} (${d.original_amount} ${d.currency})`;
            return [Markup.button.callback(label, `settle_${d.id}`)];
        });

        await ctx.reply('Šta je isplaćeno?', Markup.inlineKeyboard(buttons));
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Greška pri učitavanju liste za isplatu.');
    }
}

async function handleIzvjestaj(ctx) {
    try {
        const report = await getMonthlyReport();
        
        let message = `📅 *IZVJEŠTAJ ZA ${new Date().toLocaleString('sr-RS', { month: 'long' }).toUpperCase()}*\n\n`;
        message += `💰 Ukupni prihodi: *${report.totalIncome.toFixed(2)}*\n`;
        message += `📉 Ukupni rashodi: *${report.totalExpense.toFixed(2)}*\n`;
        message += `⚖️ Razlika: *${(report.totalIncome - report.totalExpense).toFixed(2)}*\n\n`;
        
        message += `🔍 *PO KATEGORIJAMA:*\n`;
        for (const [cat, val] of Object.entries(report.byCategory)) {
            const emoji = val >= 0 ? '➕' : '➖';
            message += `${emoji} ${cat}: ${Math.abs(val).toFixed(2)}\n`;
        }

        await ctx.replyWithMarkdown(message);
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Greška pri generisanju izvještaja.');
    }
}

module.exports = {
    handleStanje,
    handleTransfer,
    handleDugovi,
    handleDug,
    handleIsplati,
    handleIzvjestaj
};