const supabase = require('../db/supabase'); // OVO JE FALILO

async function addDebt(userId, person, amount, currency, description, direction) {
    const { data, error } = await supabase
        .from('debts')
        .insert([{
            direction: direction,
            counterparty: person,
            currency: currency,
            original_amount: Math.abs(amount),
            remaining_amount: Math.abs(amount),
            status: 'ACTIVE',
            description: description,
            // Povezujemo dug sa tvojim glavnim novčanikom u Novom Sadu
            linked_location: direction === 'I_OWE' ? 'NS_DAILY' : null 
        }]);

    if (error) {
        console.error("Supabase insert error:", error);
        throw error;
    }
    return data;
}

async function settleDebt(debtId) {
    const { data, error } = await supabase
        .from('debts')
        .update({ 
            status: 'SETTLED', 
            remaining_amount: 0,
            updated_at: new Date() 
        })
        .eq('id', debtId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Ažurirani export na dnu fajla
module.exports = { addDebt, settleDebt };

