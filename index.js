import { getAccessToken } from './auth.js';
import {
    addLabelToMessage, getMessageContent, ensureLabelId,
    listVintedMessages, listVintedBoostMessages, listVintedVitrineMessages,
    listVintedTransfertMessages, listVintedRefundMessages, listVintedSoldMessages
} from './gmail.js'
import {
    extractVintedData, extractVintedBoostData, extractVintedVitrineData,
    extractVintedTransfertData, extractVintedRefundData, extractVintedSoldData
} from './parser.js'
import {appendToSheet, appendBoostToSheet, appendTransfertToSheet, appendRefundToSheet, appendSoldToSheet} from './sheets.js'

const BATCH_SIZE = 100;

export const handler = async () => {
    try {
        const accessToken = await getAccessToken();
        
        // Traitement des mails d'achats Vinted
        console.log('=== TRAITEMENT DES ACHATS VINTED ===');
        const messagesAchats = await listVintedMessages(accessToken);
        console.log(`Messages Vinted achats trouvés : ${messagesAchats.length}`);

        const batchAchats = messagesAchats.slice(0, BATCH_SIZE);
        const labelIdAchats = await ensureLabelId(accessToken, 'vinted-achats');
        const datasAchats = [];
        
        for (const msg of batchAchats) {
            const { html } = await getMessageContent(accessToken, msg.id);
            if (!html) {
                console.log(`[Extraction échouée] Pas de HTML pour le message ID: ${msg.id}`);
                continue;
            }
            const data = extractVintedData(html);
            if (!data) {
                console.log(`[Extraction échouée] Données non extraites pour le message ID: ${msg.id}`);
                console.log(`[Extrait HTML]`, html.substring(0, 200));
                continue;
            }
            datasAchats.push(data);
            console.log(`[Labellisation] Tentative d'ajout du label pour le message ID: ${msg.id}`);
            try {
                await addLabelToMessage(accessToken, msg.id, labelIdAchats);
            } catch (err) {
                console.error(`[Labellisation échouée] pour le message ID: ${msg.id} - Erreur: ${err.message}`, err.response?.data, err.stack);
            }
        }
        
        await appendToSheet(datasAchats);

        // Traitement des mails de boost Vinted
        console.log('=== TRAITEMENT DES BOOSTS VINTED ===');
        const messagesBoost = await listVintedBoostMessages(accessToken);
        console.log(`Messages Vinted boost trouvés : ${messagesBoost.length}`);

        const batchBoost = messagesBoost.slice(0, BATCH_SIZE);
        const labelIdBoost = await ensureLabelId(accessToken, 'vinted-boost');
        const datasBoost = [];
        
        for (const msg of batchBoost) {
            const { html, internalDate } = await getMessageContent(accessToken, msg.id);
            if (!html) {
                console.log(`[Extraction échouée] Pas de HTML pour le message ID: ${msg.id}`);
                continue;
            }
            const data = extractVintedBoostData(html, internalDate);
            if (!data) {
                console.log(`[Extraction échouée] Données non extraites pour le message ID: ${msg.id}`);
                console.log(`[Extrait HTML]`, html.substring(0, 200));
                continue;
            }
            datasBoost.push(data);
            console.log(`[Labellisation] Tentative d'ajout du label pour le message ID: ${msg.id}`);
            try {
                await addLabelToMessage(accessToken, msg.id, labelIdBoost);
            } catch (err) {
                console.error(`[Labellisation échouée] pour le message ID: ${msg.id} - Erreur: ${err.message}`, err.response?.data, err.stack);
            }
        }
        
        await appendBoostToSheet(datasBoost);

        // Traitement des mails de Dressing en Vitrine
        console.log('=== TRAITEMENT DES DRESSING EN VITRINE ===');
        const messagesVitrine = await listVintedVitrineMessages(accessToken);
        console.log(`Messages Vinted Vitrine trouvés : ${messagesVitrine.length}`);

        const batchVitrine = messagesVitrine.slice(0, BATCH_SIZE);
        const datasVitrine = [];
        
        for (const msg of batchVitrine) {
            const { html, internalDate } = await getMessageContent(accessToken, msg.id);
            if (!html) {
                console.log(`[Extraction échouée] Pas de HTML pour le message ID: ${msg.id}`);
                continue;
            }
            const data = extractVintedVitrineData(html, internalDate);
            if (!data) {
                console.log(`[Extraction échouée] Données non extraites pour le message ID: ${msg.id}`);
                console.log(`[Extrait HTML]`, html.substring(0, 200));
                continue;
            }
            datasVitrine.push(data);
            console.log(`[Labellisation] Tentative d'ajout du label pour le message ID: ${msg.id}`);
            try {
                // On utilise le même label que pour les boosts pour éviter de retraiter
                await addLabelToMessage(accessToken, msg.id, labelIdBoost);
            } catch (err) {
                console.error(`[Labellisation échouée] pour le message ID: ${msg.id} - Erreur: ${err.message}`, err.response?.data, err.stack);
            }
        }
        
        await appendBoostToSheet(datasVitrine);

        // Traitement des mails de transfert bancaire Vinted
        console.log('=== TRAITEMENT DES TRANSFERTS BANCAIRES VINTED ===');
        const messagesTransfert = await listVintedTransfertMessages(accessToken);
        console.log(`Messages Vinted transfert trouvés : ${messagesTransfert.length}`);

        const batchTransfert = messagesTransfert.slice(0, BATCH_SIZE);
        const labelIdTransfert = await ensureLabelId(accessToken, 'vinted-transfert');
        const datasTransfert = [];
        for (const msg of batchTransfert) {
            const { html } = await getMessageContent(accessToken, msg.id);
            if (!html) {
                console.log(`[Extraction échouée] Pas de HTML pour le message ID: ${msg.id}`);
                continue;
            }
            const data = extractVintedTransfertData(html);
            if (!data) {
                console.log(`[Extraction échouée] Données non extraites pour le message ID: ${msg.id}`);
                console.log(`[Extrait HTML]`, html.substring(0, 200));
                continue;
            }
            datasTransfert.push(data);
            console.log(`[Labellisation] Tentative d'ajout du label pour le message ID: ${msg.id}`);
            try {
                await addLabelToMessage(accessToken, msg.id, labelIdTransfert);
            } catch (err) {
                console.error(`[Labellisation échouée] pour le message ID: ${msg.id} - Erreur: ${err.message}`, err.response?.data, err.stack);
            }
        }
        await appendTransfertToSheet(datasTransfert);

        // Traitement des mails de remboursement Vinted
        console.log('=== TRAITEMENT DES REMBOURSEMENTS VINTED ===');
        const messagesRefund = await listVintedRefundMessages(accessToken);
        console.log(`Messages Vinted remboursement trouvés : ${messagesRefund.length}`);

        const batchRefund = messagesRefund.slice(0, BATCH_SIZE);
        const labelIdRefund = await ensureLabelId(accessToken, 'vinted-remboursement');
        const datasRefund = [];
        for (const msg of batchRefund) {
            const { html, internalDate } = await getMessageContent(accessToken, msg.id);
            if (!html) {
                console.log(`[Extraction échouée] Pas de HTML pour le message ID: ${msg.id}`);
                continue;
            }
            const data = extractVintedRefundData(html, internalDate);
            if (!data) {
                console.log(`[Extraction échouée] Données non extraites pour le message ID: ${msg.id}`);
                console.log(`[Extrait HTML]`, html.substring(0, 200));
                continue;
            }
            datasRefund.push(data);
            console.log(`[Labellisation] Tentative d'ajout du label pour le message ID: ${msg.id}`);
            try {
                await addLabelToMessage(accessToken, msg.id, labelIdRefund);
            } catch (err) {
                console.error(`[Labellisation échouée] pour le message ID: ${msg.id} - Erreur: ${err.message}`, err.response?.data, err.stack);
            }
        }
        await appendRefundToSheet(datasRefund);

        // Traitement des mails de vente Vinted
        console.log('=== TRAITEMENT DES VENTES VINTED ===');
        const messagesSold = await listVintedSoldMessages(accessToken);
        console.log(`Messages Vinted vente trouvés : ${messagesSold.length}`);

        const batchSold = messagesSold.slice(0, BATCH_SIZE);
        const labelIdSold = await ensureLabelId(accessToken, 'vinted-vente');
        const datasSold = [];
        for (const msg of batchSold) {
            const { html, internalDate } = await getMessageContent(accessToken, msg.id);
            if (!html) {
                console.log(`[Extraction échouée] Pas de HTML pour le message ID: ${msg.id}`);
                continue;
            }
            const data = extractVintedSoldData(html, internalDate);
            if (!data) {
                console.log(`[Extraction échouée] Données non extraites pour le message ID: ${msg.id}`);
                console.log(`[Extrait HTML]`, html.substring(0, 200));
                continue;
            }
            datasSold.push(data);
            console.log(`[Labellisation] Tentative d'ajout du label pour le message ID: ${msg.id}`);
            try {
                await addLabelToMessage(accessToken, msg.id, labelIdSold);
            } catch (err) {
                console.error(`[Labellisation échouée] pour le message ID: ${msg.id} - Erreur: ${err.message}`, err.response?.data, err.stack);
            }
        }
        await appendSoldToSheet(datasSold);

        // Indique s'il reste des messages à traiter
        const resteAchats = messagesAchats.length - batchAchats.length;
        const resteBoost = messagesBoost.length - batchBoost.length;
        const resteVitrine = messagesVitrine.length - batchVitrine.length;
        
        if (resteAchats > 0 || resteBoost > 0 || resteVitrine > 0) {
            console.log(`Il reste ${resteAchats} messages achats, ${resteBoost} messages boost et ${resteVitrine} messages vitrine à traiter. Relance la Lambda.`);
        }

        return { statusCode: 200, body: 'OK' };
    } catch (err) {
        console.error('Erreur Lambda :', err.message, err.stack, err.response?.data);
        return { statusCode: 500, body: 'Erreur' };
    }
};
