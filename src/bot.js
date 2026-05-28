require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const authMiddleware = require('./middleware/auth');

// Uvoz parsera i servisa za transakcije
const { parseExpense } = require('./utils/parser');
const { addIncome, addExpense } = require('./services/transactionService');
const { LOCATIONS } = require('./utils/constants');

// Servis za dugove
const { settleDebt } = require('./services/debtService'); 

const sessions = {}; 
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// --- ISPRAVLJEN UVOZ HENDLERA ---
// Sve komande uvozimo odjednom iz commandHandlers fajla
const { 
    handleStanje, 
    handleTransfer, 
    handleDugovi, 
    handleDug,
    handleIsplati,
    handleIzvjestaj 
} = require('./handlers/commandHandlers');

// Zid privatnosti - samo ti možeš da pristupiš botu
bot.use(authMiddleware);

bot.start((ctx) => {
    ctx.reply('Pozdrav Danijele! Tvoj Money Manager je spreman. 🚀');
});

// --- REGISTRACIJA SVIH KOMANDI ---
bot.command('stanje', handleStanje);     // Pregled novčanika
bot.command('prebaci', handleTransfer); // Transfer NS_DAILY <-> SEF
bot.command('dugovi', handleDugovi);   // Spisak šta ti duguju i šta duguješ
bot.command('dug', handleDug);         // Unos novog duga (npr. Željko sajt ili faks)
bot.command('isplati', handleIsplati); // Dugmići za brzo vraćanje/naplatu
bot.command('izvjestaj', handleIzvjestaj); // Mesečni presek zarade i troškova

// Logika za brzi unos preko poruke (npr. "-200 kafa rsd")
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const isExpense = text.includes('-');
    const cleanText = text.replace('-', '');
    const parsed = parseExpense(cleanText);

    if (parsed) {
        sessions[ctx.from.id] = { ...parsed, isExpense };
        const buttons = Object.keys(LOCATIONS).map(loc => [Markup.button.callback(`📍 ${loc}`, `loc_${loc}`)]);
        const tip = isExpense ? '🔴 RASHOD' : '🟢 PRIHOD';
        
        await ctx.reply(`${tip}: Gde unosiš ${parsed.amount} ${parsed.currency}?`, Markup.inlineKeyboard(buttons));
    } else {
        ctx.reply('Nisam razumeo format. Probaj: "Sajt 1100 eur" ili "-6000 ispiti rsd"');
    }
});

// --- OBRADA KLIKOVA NA DUGMAD ---
bot.on('callback_query', async (ctx) => {
    const userId = ctx.from.id;
    const callbackData = ctx.update.callback_query.data;

    // 1. Lokacija za običnu transakciju
    if (callbackData.startsWith('loc_')) {
        const selectedLoc = callbackData.replace('loc_', '');
        const data = sessions[userId];
        if (!data) return ctx.answerCbQuery('Sesija je istekla.');

        try {
            if (data.isExpense) {
                await addExpense(selectedLoc, data.currency, data.amount, data.description);
            } else {
                await addIncome(selectedLoc, data.currency, data.amount, data.description);
            }
            const statusText = data.isExpense ? 'skinuto sa' : 'dodato na';
            await ctx.editMessageText(`✅ Uspešno! ${data.amount} ${data.currency} ${statusText} ${selectedLoc}`);
            delete sessions[userId];
        } catch (error) {
            ctx.answerCbQuery('Greška pri upisu u bazu.', { show_alert: true });
        }
    }

    // 2. Isplata duga preko dugmeta
    if (callbackData.startsWith('settle_')) {
        const debtId = callbackData.replace('settle_', '');
        try {
            const debt = await settleDebt(debtId);
            
            // Automatski update stanja: ako si vratio faks, skida sa NS_DAILY
            // Ako ti je Željko platio sajt, dodaje na NS_DAILY
            if (debt.direction === 'I_OWE') {
                await addExpense('NS_DAILY', debt.currency, debt.original_amount, `Isplata duga: ${debt.counterparty}`);
            } else {
                await addIncome('NS_DAILY', debt.currency, debt.original_amount, `Naplata duga: ${debt.counterparty}`);
            }

            await ctx.editMessageText(`✅ *Dug isplaćen!*\n👤 ${debt.counterparty}\n💰 ${debt.original_amount} ${debt.currency}\n\nStanje u novčaniku je automatski ažurirano.`);
        } catch (error) {
            console.error(error);
            ctx.answerCbQuery('Greška pri isplati duga.');
        }
    }
    
    ctx.answerCbQuery();
});

bot.catch((err, ctx) => {
    console.error(`Greška kod ${ctx.updateType}:`, err);
});

// Lažni server koji drži bota budnim na Renderu
const http = require('http');
http.createServer((req, res) => {
    res.write('Bot je online i radi!');
    res.end();
}).listen(process.env.PORT || 3000);

module.exports = bot;