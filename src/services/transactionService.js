const supabase = require('../db/supabase');
const { TRANSACTION_TYPES } = require('../utils/constants');

async function addIncome(location, currency, amount, description) {
    const { error: walletError } = await supabase.rpc('increment_balance', {
        p_location: location, p_currency: currency, p_amount: amount
    });
    if (walletError) throw walletError;

    await supabase.from('transactions').insert([{
        type: TRANSACTION_TYPES.INCOME, location, currency, amount, description
    }]);
}

// NOVO: Funkcija za rashode
async function addExpense(location, currency, amount, description) {
    const { error: walletError } = await supabase.rpc('decrement_balance', {
        p_location: location, p_currency: currency, p_amount: amount
    });
    
    if (walletError) throw walletError;

    await supabase.from('transactions').insert([{
        type: TRANSACTION_TYPES.EXPENSE, location, currency, amount, description
    }]);
}

module.exports = { addIncome, addExpense };