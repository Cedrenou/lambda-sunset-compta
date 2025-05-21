import * as cheerio from 'cheerio';

export function extractVintedData(html) {
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim(); // texte "nettoyé"

    const match = (regex) => {
        const result = text.match(regex);
        return result ? result[1].trim() : undefined;
    };

    return {
        beneficiaire: match(/Bénéficiaire\s*:\s*(.+?)\s+Commande\s*:/),
        article: match(/Commande\s*:\s*(.+?)\s+Montant payé/),
        montant_total: match(/Montant payé\s*:\s*([\d,]+)\s/),
        frais_port: match(/frais de port\s*:\s*([\d,]+)/),
        montant_commande: match(/commande\s*:\s*([\d,]+)/),
        frais_protection: match(/Protection acheteurs\s*:\s*([\d,]+)/),
        date_paiement: match(/Date du paiement\s*:\s*([0-9:\-\s]+)/),
        transaction_id: match(/N° de transaction\s*:\s*(\d+)/),
        reduction: match(/Réduction\s*:\s*([\d,]+) ?€?/)
    };
}
