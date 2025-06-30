import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
dayjs.extend(utc);
dayjs.extend(timezone);

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
        reduction: match(/Réduction\s*:\s*([\d,]+) ?€?/),
        mode_paiement: match(/Mode\(s\) de paiement\s*:\s*([^\n]+?)\s+Date du paiement/)
    };
}

export function extractVintedBoostData(html, internalDate) {
    const $ = cheerio.load(html);
    // On préserve les sauts de ligne pour pouvoir cibler la ligne sous le total
    const text = $('body').text().replace(/[ \t]+/g, ' ').trim();

    const match = (regex) => {
        const result = text.match(regex);
        return result && result[1] ? result[1].trim() : undefined;
    };

    const getFloat = (regex) => {
        const str = match(regex);
        return str ? parseFloat(str.replace(',', '.')) : undefined;
    };

    const date = internalDate ? dayjs(parseInt(internalDate)).format('YYYY-MM-DD HH:mm') : undefined;

    return {
        date_boost: date,
        montant_boost: getFloat(/Boost .*? de \d+ jours.*?\s+([\d,.]+)\s*€/),
        reduction: getFloat(/Réduction\s+-([\d,.]+)\s*€/),
        montant_total: getFloat(/Total\s+([\d,.]+)\s*€/),
        moyen_paiement: match(/Total\s+[\d,.]+\s*€\s*\n\s*([^\n\r]+)/)
    };
}

export function extractVintedVitrineData(html, internalDate) {
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/[ \t]+/g, ' ').trim();

    const match = (regex) => {
        const result = text.match(regex);
        return result && result[1] ? result[1].trim() : undefined;
    };

    const getFloat = (regex) => {
        const str = match(regex);
        return str ? parseFloat(str.replace(',', '.')) : undefined;
    };

    const date = internalDate ? dayjs(parseInt(internalDate)).format('YYYY-MM-DD HH:mm') : undefined;

    // On mappe les données de la vitrine sur la structure existante
    return {
        date_boost: internalDate ? parseInt(internalDate) : undefined,
        montant_boost: getFloat(/Dressing en Vitrine.*?\s+([\d,.]+)\s*€/),
        reduction: getFloat(/Réduction\s+-([\d,.]+)\s*€/),
        montant_total: getFloat(/Total\s+([\d,.]+)\s*€/),
        moyen_paiement: match(/Total\s+[\d,.]+\s*€\s*\n\s*([^\n\r]+)/)
    };
}

export function extractVintedTransfertData(html) {
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    const match = (regex) => {
        const result = text.match(regex);
        return result ? result[1].trim() : undefined;
    };

    return {
        beneficiaire: match(/Bénéficiaire\s*:\s*([^\n]+?)\s+Montant du/),
        montant: match(/Montant du\s*transfert\s*:\s*([\d,.]+)\s*€/),
        compte: match(/N° du compte\s*:\s*([^\n]+?)\s+Transfert émit/),
        date_emission: match(/Transfert émit le\s*:\s*([0-9:\-\s]+)/),
        date_reception: match(/Réception estimée du\s*transfert\s*:\s*([0-9\/]+)/)
    };
}

export function extractVintedRefundData(html, internalDate) {
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    const match = (regex) => {
        const result = text.match(regex);
        return result ? result[1].trim().replace(/^["']|["']$/g, '') : undefined;
    };

    const dateReception = internalDate ? dayjs(parseInt(internalDate)).tz('Europe/Paris').format('YYYY-MM-DD HH:mm') : undefined;

    let dateRemboursement = match(/Remboursement estimé sur Carte bancaire\s*:\s*([0-9\/]+)/);
    if (!dateRemboursement) {
        // Cherche la date après 'Remboursé dans le porte-monnaie Vinted' (même ligne ou ligne suivante)
        const porteMonnaieRegex = /Remboursé dans le porte-monnaie Vinted\s*:?\s*([0-9\/]+)/;
        const porteMonnaieDate = text.match(porteMonnaieRegex);
        if (porteMonnaieDate && porteMonnaieDate[1]) {
            dateRemboursement = porteMonnaieDate[1];
        } else if (text.includes('Remboursé dans le porte-monnaie Vinted')) {
            dateRemboursement = 'Remboursé dans le porte-monnaie Vinted';
        }
    }

    let modePaiement = match(/Carte utilisée\s*:\s*([^\n]+?)\s+N° de transaction/);
    if (!modePaiement) {
        modePaiement = match(/Mode de paiement\s*:\s*([^\n]+?)\s+N° de transaction/);
    }
    return {
        destinataire: match(/Destinataire\s*:\s*([^\n]+?)\s+Commande/),
        commande: match(/Commande\s*:\s*([^\"]+\"[^\"]+\")/),
        montant: match(/Montant remboursé\s*:\s*([\d,.]+)\s*€/),
        mode_paiement: modePaiement,
        transaction_id: match(/N° de transaction\s*:\s*(\d+)/),
        date_remboursement: dateRemboursement,
        date_reception_mail: dateReception
    };
}

export function extractVintedSoldData(html, internalDate) {
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    const match = (regex) => {
        const result = text.match(regex);
        return result ? result[1].trim() : undefined;
    };

    const adresse = match(/Adresse\s*:\s*([^\n]+),/);
    let nom = '', rue = '', ville = '', code_postal = '', pays = '', pays_texte = '';
    if (adresse) {
        const parts = adresse.split(',').map(s => s.trim());
        nom = parts[0] || '';
        rue = parts[1] || '';
        ville = parts[2] || '';
        code_postal = parts[3] || '';
        pays = parts[4] || '';
        pays_texte = parts[5] || '';
    }
    return {
        acheteur_email: match(/Adresse e-mail\s*:\s*([\w.-]+@[\w.-]+)/i),
        nom,
        rue,
        ville,
        code_postal,
        pays,
        pays_texte
    };
}
