const supabase = require('../db/supabase');

async function moveMoney(fromLoc, fromCur, toLoc, toCur, amount) {
    // Pozivamo SQL funkciju koja radi sve odjednom (skida, dodaje, zapisuje)
    const { data, error } = await supabase.rpc('atomic_transfer', {
        p_from_location: fromLoc,
        p_from_currency: fromCur,
        p_from_amount: amount,
        p_to_location: toLoc,
        p_to_currency: toCur,
        p_to_amount: amount, // Za početak pretpostavljamo da je ista valuta
        p_note: 'Transfer između lokacija'
    });

    if (error) throw error;
    return data;
}

module.exports = { moveMoney };