import { getAccessToken } from './auth.js';
import {addLabelToMessage, getMessageContent, listVintedMessages} from './gmail.js'
import {extractVintedData} from './parser.js'
import {appendToSheet} from './sheets.js'

export const handler = async () => {
    try {
        const accessToken = await getAccessToken();

        const messages = await listVintedMessages(accessToken);
        console.log(`Messages Vinted trouvés : ${messages.length}`);

        for (const msg of messages) {
            console.log('- ID du message :', msg.id);
            console.log('message', msg);
            const html = await getMessageContent(accessToken, msg.id);
            if (!html) {
                console.log('- Aucune partie HTML trouvée dans le message.');
                continue;
            }
            console.log('- Contenu HTML :', html);

            const data = extractVintedData(html);
            console.log('- Données extraites :', data);
            if (!data) {
                console.log('- Aucune donnée trouvée dans le message.');
                continue;
            }

            await appendToSheet(data);

            await addLabelToMessage(accessToken, msg.id);
        }

        return { statusCode: 200, body: 'OK' };
    } catch (err) {
        console.error('Erreur Lambda :', err.message);
        return { statusCode: 500, body: 'Erreur' };
    }
};
