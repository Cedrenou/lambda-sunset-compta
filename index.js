import { getAccessToken } from './auth.js';
import {addLabelToMessage, getMessageContent, listVintedMessages} from './gmail.js'
import {extractVintedData} from './parser.js'
import {appendToSheet} from './sheets.js'

const BATCH_SIZE = 100;

export const handler = async () => {
    try {
        const accessToken = await getAccessToken();
        const messages = await listVintedMessages(accessToken);
        console.log(`Messages Vinted trouvés : ${messages.length}`);

        // On ne traite que les BATCH_SIZE premiers messages
        const batch = messages.slice(0, BATCH_SIZE);

        const datas = [];
        for (const msg of batch) {
            const html = await getMessageContent(accessToken, msg.id);
            if (!html) {
                console.log(`[Extraction échouée] Pas de HTML pour le message ID: ${msg.id}`);
                continue;
            }
            const data = extractVintedData(html);
            if (!data) {
                // Log détaillé pour retrouver le mail
                console.log(`[Extraction échouée] Données non extraites pour le message ID: ${msg.id}`);
                // Optionnel : log un extrait du HTML pour aider au debug
                console.log(`[Extrait HTML]`, html.substring(0, 200));
                continue;
            }
            datas.push(data);
            console.log(`[Labellisation] Tentative d'ajout du label pour le message ID: ${msg.id}`);
            try {
                await addLabelToMessage(accessToken, msg.id);
            } catch (err) {
                console.error(`[Labellisation échouée] pour le message ID: ${msg.id} - Erreur: ${err.message}`);
            }
        }
        
        await appendToSheet(datas);

        // Indique s'il reste des messages à traiter
        const reste = messages.length - batch.length;
        if (reste > 0) {
            console.log(`Il reste ${reste} messages à traiter. Relance la Lambda.`);
        }

        return { statusCode: 200, body: 'OK' };
    } catch (err) {
        console.error('Erreur Lambda :', err.message);
        return { statusCode: 500, body: 'Erreur' };
    }
};
