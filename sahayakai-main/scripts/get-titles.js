const https = require('https');

const ids = [
    { id: 'hjk9s4W8pF8', channel: 'NCERT Official' },
    { id: 'qmM-zObDpxs', channel: 'NCERT Official' },
    { id: 'ZuJQ5Qblaro', channel: 'Teach For India' },
    { id: 'p9esa4nR2dE', channel: 'Teach For India' },
    { id: 'm9Q92oW_rKM', channel: 'Ministry of Education' },
    { id: 'BY3yE7kvSuQ', channel: 'Ministry of Education' }
];

function fetchTitle(id) {
    return new Promise((resolve) => {
        https.get(`https://www.youtube.com/watch?v=${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const match = /<title>(.*?)<\/title>/.exec(data);
                if (match && match[1]) {
                    let title = match[1].replace(' - YouTube', '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                    resolve(title);
                } else {
                    resolve(`Teacher Training Course (${id})`);
                }
            });
        }).on('error', () => resolve(`Teacher Training Course (${id})`));
    });
}

async function run() {
    const result = [];
    for (const item of ids) {
        const title = await fetchTitle(item.id);
        result.push({
            id: item.id,
            title: title,
            description: `Professional development and teacher training content from ${item.channel}.`,
            thumbnail: `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
            channelTitle: item.channel,
            publishedAt: new Date().toISOString()
        });
    }
    console.log(JSON.stringify(result, null, 4));
}

run();
