import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import dayjs from 'dayjs';

export async function appendToSheet(data) {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const monthLabel = dayjs(data.date_paiement, 'YYYY-MM-DD HH:mm').format('MMMM YYYY');

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheet = meta.data.sheets.find(sheet => sheet.properties.title === monthLabel);
  let sheetId = existingSheet?.properties?.sheetId;

  // 🆕 Crée l'onglet + en-têtes s’il n’existe pas
  if (!sheetId) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: monthLabel }
            }
          }
        ]
      }
    });

    sheetId = res.data.replies[0].addSheet.properties.sheetId;

    // Ajout de l'en-tête
    const headers = [[
      'Date', 'Article', 'Bénéficiaire', 'Montant total',
      'Frais port', 'Montant article', 'Frais protection',
      'Transaction ID', 'Vérifié'
    ]];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${monthLabel}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: headers }
    });

    console.log(`🆕 Onglet "${monthLabel}" créé avec en-têtes`);
  }

  // Vérifie si la transaction existe déjà
  const existingIdsResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${monthLabel}!H2:H`
  });

  const existingIds = (existingIdsResp.data.values || []).flat();

  if (existingIds.includes(data.transaction_id)) {
    console.log(`⚠️ Transaction ${data.transaction_id} déjà présente — ignorée`);
    return;
  }

  // Ajout de la ligne de données
  const values = [[
    data.date_paiement,
    data.article,
    data.beneficiaire,
    data.montant_total,
    data.frais_port,
    data.montant_commande,
    data.frais_protection,
    data.transaction_id,
    false // case décochée
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${monthLabel}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values
    }
  });

  console.log(`✅ Données ajoutées à l’onglet "${monthLabel}"`);

  // 🔁 Met à jour dynamiquement la validation checkbox sur la colonne "Vérifié"
  const dataRangeResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${monthLabel}!A2:A`
  });

  const rowCount = (dataRangeResp.data.values || []).filter(row => row[0]?.trim() !== '').length;
  const endRowIndex = rowCount + 1;  // +1 car start à la ligne 2,

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 1,              // ligne 2
              endRowIndex: endRowIndex,      // lignes réellement utilisées
              startColumnIndex: 8,           // colonne I
              endColumnIndex: 9
            },
            rule: {
              condition: {
                type: 'BOOLEAN'
              },
              strict: true,
              showCustomUi: true
            }
          }
        }
      ]
    }
  });

  console.log(`☑️ Checkbox appliquées dynamiquement jusqu’à la ligne ${endRowIndex}`);
}
