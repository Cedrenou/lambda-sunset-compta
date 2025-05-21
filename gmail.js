import axios from 'axios'

export async function listVintedMessages(accessToken) {
    const allMessages = [];
    let nextPageToken = null;
  
    do {
      const response = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: 'from:no-reply@vinted.fr subject:"Ton reçu pour la commande" -label:vinted-traite',
          maxResults: 100,
          pageToken: nextPageToken
        }
      });
  
      const messages = response.data.messages || [];
      allMessages.push(...messages);
      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);
  
    return allMessages;
  }

export async function getMessageContent(accessToken, messageId) {
    const response = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        },
        params: {
            format: 'full'
        }
    });

    console.log('Response : ',response.data)

    const payload = response.data.payload;

    // CAS 1 : multipart → on cherche le HTML dans les parties
    if (payload.parts) {
        const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
        if (htmlPart?.body?.data) {
            return Buffer.from(htmlPart.body.data, 'base64').toString('utf8');
        }
    }

    // CAS 2 : pas multipart → le HTML est directement dans payload.body
    if (payload.mimeType === 'text/html' && payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    return null; // Si on ne trouve rien
}

export async function ensureLabelId(accessToken, labelName) {
    const response = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    const existing = response.data.labels.find(l => l.name === labelName);
    if (existing) return existing.id;

    // Crée le label s'il n'existe pas
    const createResponse = await axios.post(
        'https://gmail.googleapis.com/gmail/v1/users/me/labels',
        {
            name: labelName,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show'
        },
        {
            headers: { Authorization: `Bearer ${accessToken}` }
        }
    );

    return createResponse.data.id;
}


export async function addLabelToMessage(accessToken, messageId, labelName = 'vinted-traite') {
    const labelId = await ensureLabelId(accessToken, labelName);

    await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
            addLabelIds: [labelId]
        },
        {
            headers: { Authorization: `Bearer ${accessToken}` }
        }
    );

    console.log(`🏷️ Message ${messageId} étiqueté avec "${labelName}"`);
}
