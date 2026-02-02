const { GoogleAuth } = require('google-auth-library');

/**
 * Submits a batch of URLs to the Google Indexing API using the multipart/mixed batch endpoint.
 * @param {string[]} urls - Array of URLs to index.
 * @returns {Promise<{status: number, body: string}>}
 */
async function submitIndexingBatch(urls) {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/indexing'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    const boundary = 'batch_' + Math.random().toString(36).substring(2);
    const multipartBody = urls
        .map((url) => {
            return (
                `--${boundary}\r\n` +
                'Content-Type: application/http\r\n' +
                'Content-Transfer-Encoding: binary\r\n\r\n' +
                'POST /v3/urlNotifications:publish HTTP/1.1\r\n' +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify({ url, type: 'URL_UPDATED' }) + '\r\n'
            );
        })
        .join('') + `--${boundary}--`;

    const response = await fetch('https://indexing.googleapis.com/batch', {
        method: 'POST',
        headers: {
            'Content-Type': `multipart/mixed; boundary=${boundary}`,
            'Authorization': `Bearer ${token}`,
        },
        body: multipartBody,
    });

    const responseText = await response.text();

    if (!response.ok) {
        if ([400, 403, 429].includes(response.status)) {
            // Basic error handling as requested
            console.error(`Indexing API Error (${response.status}):`, responseText);
        }
    }

    return {
        status: response.status,
        body: responseText,
    };
}

/**
 * Checks the indexing status of URLs using the Search Console URL Inspection API.
 * @param {string[]} urls - Array of URLs to inspect.
 * @param {string} siteUrl - The property URL (e.g., https://example.com/).
 * @returns {Promise<any[]>}
 */
async function checkIndexingStatus(urls, siteUrl) {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/searchconsole.readonly'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    const inspectionPromises = urls.map(async (url) => {
        const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                inspectionUrl: url,
                siteUrl: siteUrl,
            }),
        });
        return res.json();
    });

    return Promise.all(inspectionPromises);
}

module.exports = {
    submitIndexingBatch,
    checkIndexingStatus,
};
