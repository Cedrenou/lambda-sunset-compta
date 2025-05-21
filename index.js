import { getAccessToken } from './auth.js';
import {addLabelToMessage, getMessageContent, listVintedMessages} from './gmail.js'
import {extractVintedData} from './parser.js'
import {appendToSheet} from './sheets.js'

const BATCH_SIZE = 200;

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
            if (!html) continue; 
            const data = extractVintedData(html);
            if (!data) continue; 
            datas.push(data);
            await addLabelToMessage(accessToken, msg.id);
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
