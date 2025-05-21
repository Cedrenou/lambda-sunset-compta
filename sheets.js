import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import dayjs from 'dayjs';

export async function appendToSheet(datas) {
  if (!Array.isArray(datas) || datas.length === 0) return;

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;

  // Regroupe les datas par mois
  const datasByMonth = {};
  for (const data of datas) {
    const monthLabel = dayjs(data.date_paiement, 'YYYY-MM-DD HH:mm').format('MMMM YYYY');
    if (!datasByMonth[monthLabel]) datasByMonth[monthLabel] = [];
    datasByMonth[monthLabel].push(data);
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId });

  for (const [monthLabel, monthDatas] of Object.entries(datasByMonth)) {
    let existingSheet = meta.data.sheets.find(sheet => sheet.properties.title === monthLabel);
    let sheetId = existingSheet?.properties?.sheetId;

    // Crée l'onglet si besoin
    if (!sheetId) {
      const res = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: monthLabel } } }]
        }
      });
      sheetId = res.data.replies[0].addSheet.properties.sheetId;

      // Ajoute l'en-tête
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
    }

    // Récupère les IDs existants une seule fois
    const existingIdsResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${monthLabel}!H2:H`
    });
    const existingIds = (existingIdsResp.data.values || []).flat();

    // Filtre les nouvelles transactions
    const newValues = monthDatas
      .filter(data => !existingIds.includes(data.transaction_id))
      .map(data => [
        data.date_paiement,
        data.article,
        data.beneficiaire,
        data.montant_total,
        (parseFloat((data.frais_port || '0').replace(',', '.')) - parseFloat((data.reduction || '0').replace(',', '.'))).toFixed(2),
        data.montant_commande,
        data.frais_protection,
        data.transaction_id,
        false
      ]);

    if (newValues.length === 0) {
      console.log(`Aucune nouvelle donnée à ajouter pour "${monthLabel}"`);
      continue;
    }

    // Ajoute toutes les nouvelles lignes d'un coup
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${monthLabel}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newValues }
    });

    console.log(`✅ ${newValues.length} données ajoutées à l'onglet "${monthLabel}"`);

    // Met à jour la validation checkbox
    const dataRangeResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${monthLabel}!A2:A`
    });
    const rowCount = (dataRangeResp.data.values || []).filter(row => row[0]?.trim() !== '').length;
    const endRowIndex = rowCount + 1;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: endRowIndex,
                startColumnIndex: 8,
                endColumnIndex: 9
              },
              rule: {
                condition: { type: 'BOOLEAN' },
                strict: true,
                showCustomUi: true
              }
            }
          }
        ]
      }
    });

    console.log(`☑️ Checkbox appliquées dynamiquement jusqu'à la ligne ${endRowIndex}`);

    // Ajoute une ligne de total en bas du tableau
    const totalRowIndex = rowCount + 2; // +2 car header + 1ère ligne = 2
    const totalRow = [
      'TOTAL',
      '',
      '',
      `=SUM(D2:D${rowCount+1})`, // Montant total
      `=SUM(E2:E${rowCount+1})`, // Frais port
      `=SUM(F2:F${rowCount+1})`, // Montant article
      `=SUM(G2:G${rowCount+1})`, // Frais protection
      '',
      ''
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${monthLabel}!A${totalRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [totalRow] }
    });
    console.log(`🧮 Ligne de total ajoutée à la ligne ${totalRowIndex} de l'onglet "${monthLabel}"`);
  }
}
