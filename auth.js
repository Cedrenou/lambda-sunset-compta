import axios from 'axios';

export async function getAccessToken() {
    const {
        CLIENT_ID,
        CLIENT_SECRET,
        REFRESH_TOKEN
    } = process.env;

    const response = await axios.post('https://oauth2.googleapis.com/token', null, {
        params: {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: REFRESH_TOKEN,
            grant_type: 'refresh_token',
        }
    });

    return response.data.access_token;
}
