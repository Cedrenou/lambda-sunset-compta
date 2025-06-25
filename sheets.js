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
        'Transaction ID', 'Mode de paiement', 'Vérifié'
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

    // Trie les données du mois par date_paiement (ordre croissant)
    monthDatas.sort((a, b) => {
      if (!a.date_paiement) return 1;
      if (!b.date_paiement) return -1;
      return a.date_paiement.localeCompare(b.date_paiement);
    });

    // Filtre les nouvelles transactions
    const newValues = monthDatas
      .filter(data => !existingIds.includes(data.transaction_id))
      .map(data => [
        data.date_paiement,
        data.article,
        data.beneficiaire,
        data.montant_total,
        (parseFloat((data.frais_port || '0').replace(',', '.')) - parseFloat((data.reduction || '0').replace(',', '.'))).toFixed(2).replace('.', ','),
        data.montant_commande,
        data.frais_protection,
        data.transaction_id,
        data.mode_paiement,
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
                startColumnIndex: 9,
                endColumnIndex: 10
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

    // Supprime la ligne TOTAL existante si elle existe
    const allRowsResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${monthLabel}!A1:J`,
    });
    const allRows = allRowsResp.data.values || [];
    const totalRowIdx = allRows.findIndex(row => row[0] && row[0].toString().toUpperCase().includes('TOTAL'));
    if (totalRowIdx !== -1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: totalRowIdx,
                  endIndex: totalRowIdx + 1
                }
              }
            }
          ]
        }
      });
      console.log(`🗑️ Ligne TOTAL supprimée à l'index ${totalRowIdx + 1} dans l'onglet "${monthLabel}"`);
    }

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

export async function appendBoostToSheet(datas) {
  if (!Array.isArray(datas) || datas.length === 0) return;

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.BOOST_SPREADSHEET_ID;

  // Regroupe les datas par mois
  const datasByMonth = {};
  for (const data of datas) {
    const monthLabel = dayjs(data.date_boost).format('MMMM YYYY');
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

      // Ajoute l'en-tête pour les boosts
      const headers = [[
        'Date', 'Montant Boost', 'Réduction', 'Montant Total', 'Moyen de Paiement'
      ]];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${monthLabel}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: headers }
      });
    }

    // Il n'y a plus de déduplication ici, on se fie au label Gmail
    const newValues = monthDatas
      .map(data => [
        dayjs(data.date_boost).format('YYYY-MM-DD HH:mm'),
        data.montant_boost,
        data.reduction,
        data.montant_total,
        data.moyen_paiement,
      ]);

    if (newValues.length === 0) {
      console.log(`Aucune nouvelle donnée boost à ajouter pour "${monthLabel}"`);
      continue;
    }

    // Ajoute toutes les nouvelles lignes d'un coup
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${monthLabel}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newValues }
    });

    console.log(`✅ ${newValues.length} données boost ajoutées à l'onglet "${monthLabel}"`);

    // Supprime la ligne TOTAL existante si elle existe
    const allRowsResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${monthLabel}!A1:E`,
    });
    const allRows = allRowsResp.data.values || [];
    const totalRowIdx = allRows.findIndex(row => row[0] && row[0].toString().toUpperCase().includes('TOTAL'));
    if (totalRowIdx !== -1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: totalRowIdx,
                  endIndex: totalRowIdx + 1
                }
              }
            }
          ]
        }
      });
      console.log(`🗑️ Ligne TOTAL supprimée à l'index ${totalRowIdx + 1} dans l'onglet "${monthLabel}"`);
    }

    // Récupère le nombre de lignes pour la nouvelle ligne de total
    const dataRangeResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${monthLabel}!A2:A`
    });
    const rowCount = (dataRangeResp.data.values || []).filter(row => row[0]?.trim() !== '').length;

    // Ajoute une ligne de total en bas du tableau
    const totalRowIndex = rowCount + 2; // +2 car header + 1ère ligne = 2
    const totalRow = [
      'TOTAL',
      `=SUM(B2:B${rowCount+1})`, // Montant boost
      `=SUM(C2:C${rowCount+1})`, // Réduction
      `=SUM(D2:D${rowCount+1})`, // Montant Total
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

export async function appendTransfertToSheet(datas) {
  if (!Array.isArray(datas) || datas.length === 0) return;

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.TRANSFERT_SPREADSHEET_ID;

  // Regroupe les datas par mois
  const datasByMonth = {};
  for (const data of datas) {
    const monthLabel = data.date_emission ? dayjs(data.date_emission, 'YYYY-MM-DD HH:mm').format('MMMM YYYY') : 'Sans date';
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
        'Date émission', 'Date réception estimée', 'Bénéficiaire', 'Montant', 'Compte'
      ]];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${monthLabel}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: headers }
      });
    }

    // Trie par date émission
    monthDatas.sort((a, b) => {
      if (!a.date_emission) return 1;
      if (!b.date_emission) return -1;
      return a.date_emission.localeCompare(b.date_emission);
    });

    // Prépare les valeurs
    const newValues = monthDatas.map(data => [
      data.date_emission,
      data.date_reception,
      data.beneficiaire,
      data.montant,
      data.compte
    ]);

    if (newValues.length === 0) continue;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${monthLabel}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newValues }
    });

    console.log(`✅ ${newValues.length} transferts ajoutés à l'onglet "${monthLabel}"`);
  }
}

export async function appendRefundToSheet(datas) {
  if (!Array.isArray(datas) || datas.length === 0) return;

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.REFUND_SPREADSHEET_ID

  // Regroupe les datas par mois
  const datasByMonth = {};
  for (const data of datas) {
    const monthLabel = data.date_reception_mail ? dayjs(data.date_reception_mail, 'YYYY-MM-DD HH:mm').format('MMMM YYYY') : 'Sans date';
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
        'Date de réception du mail', 'Date remboursement', 'Article', 'Montant', 'Mode de paiement', 'Transaction ID', 'Destinataire'
      ]];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${monthLabel}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: headers }
      });
    }

    // Trie par date remboursement
    monthDatas.sort((a, b) => {
      if (!a.date_reception_mail) return 1;
      if (!b.date_reception_mail) return -1;
      return a.date_reception_mail.localeCompare(b.date_reception_mail);
    });

    // Prépare les valeurs
    const newValues = monthDatas.map(data => [
      data.date_reception_mail,
      data.date_remboursement,
      data.commande,
      data.montant,
      (data.date_remboursement === 'Remboursé dans le porte-monnaie Vinted' ? 'porte-monnaie Vinted' : data.mode_paiement),
      data.transaction_id,
      data.destinataire
    ]);

    if (newValues.length === 0) continue;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${monthLabel}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newValues }
    });

    console.log(`✅ ${newValues.length} remboursements ajoutés à l'onglet "${monthLabel}"`);
  }
}
