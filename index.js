import { getAccessToken } from './auth.js';
import {addLabelToMessage, getMessageContent, listVintedMessages, listVintedBoostMessages, ensureLabelId} from './gmail.js'
import {extractVintedData, extractVintedBoostData} from './parser.js'
import {appendToSheet, appendBoostToSheet} from './sheets.js'

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
            const html = await getMessageContent(accessToken, msg.id);
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
            const html = await getMessageContent(accessToken, msg.id);
            if (!html) {
                console.log(`[Extraction échouée] Pas de HTML pour le message ID: ${msg.id}`);
                continue;
            }
            const data = extractVintedBoostData(html);
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

        // Indique s'il reste des messages à traiter
        const resteAchats = messagesAchats.length - batchAchats.length;
        const resteBoost = messagesBoost.length - batchBoost.length;
        
        if (resteAchats > 0 || resteBoost > 0) {
            console.log(`Il reste ${resteAchats} messages achats et ${resteBoost} messages boost à traiter. Relance la Lambda.`);
        }

        return { statusCode: 200, body: 'OK' };
    } catch (err) {
        console.error('Erreur Lambda :', err.message, err.stack, err.response?.data);
        return { statusCode: 500, body: 'Erreur' };
    }
};
