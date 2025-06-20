import axios from 'axios'

export async function listVintedMessages(accessToken) {
    const allMessages = [];
    let nextPageToken = null;
  
    do {
      const response = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: 'from:no-reply@vinted.fr subject:"Ton reçu pour la commande" -label:vinted-achats',
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

export async function listVintedBoostMessages(accessToken) {
    const allMessages = [];
    let nextPageToken = null;
  
    do {
      const response = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: 'from:no-reply@vinted.fr subject:"Articles boostés : ta facture" -label:vinted-boost',
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

export async function listVintedVitrineMessages(accessToken) {
    const allMessages = [];
    let nextPageToken = null;
  
    do {
      const response = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: 'from:no-reply@vinted.fr subject:"Dressing en Vitrine - Ta facture" -label:vinted-boost',
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

    const payload = response.data.payload;
    const internalDate = response.data.internalDate;

    let html = null;
    // CAS 1 : multipart → on cherche le HTML dans les parties
    if (payload.parts) {
        const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
        if (htmlPart?.body?.data) {
            html = Buffer.from(htmlPart.body.data, 'base64').toString('utf8');
        }
    }

    // CAS 2 : pas multipart → le HTML est directement dans payload.body
    else if (payload.mimeType === 'text/html' && payload.body?.data) {
        html = Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    return { html, internalDate };
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


export async function addLabelToMessage(accessToken, messageId, labelId) {
    await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
            addLabelIds: [labelId]
        },
        {
            headers: { Authorization: `Bearer ${accessToken}` }
        }
    ).then(response => {
        console.log(`[Labellisation API] Réponse pour ${messageId}:`, response.data);
    });

    console.log(`🏷️ Message ${messageId} étiqueté avec l'ID "${labelId}"`);
}

