require('dotenv').config();
const bot = require('./bot');

// Palimo bota
bot.launch().then(() => {
    console.log('🤖 Bot je uspešno pokrenut lokalno! Pošalji mu /start na Telegramu.');
});

// Omogućava graciozno gašenje iz terminala (Ctrl + C)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));