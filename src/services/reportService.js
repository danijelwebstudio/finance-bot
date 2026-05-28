const supabase = require('../db/supabase');

async function getMonthlyReport() {
    const now = new Date();
    // Prvi dan tekućeg meseca
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    // Dohvatanje svih transakcija za ovaj mesec
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', startOfMonth);

    if (error) throw error;

    const report = {
        totalIncome: 0,
        totalExpense: 0,
        byCategory: {}
    };

    transactions.forEach(t => {
        if (t.type === 'INCOME') {
            report.totalIncome += t.amount;
        } else {
            report.totalExpense += t.amount;
        }

        // Grupisati po opisu/kategoriji
        const cat = t.description || 'Ostalo';
        if (!report.byCategory[cat]) report.byCategory[cat] = 0;
        report.byCategory[cat] += (t.type === 'INCOME' ? t.amount : -t.amount);
    });

    return report;
}

module.exports = { getMonthlyReport };