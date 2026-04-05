const https = require('https');
const fs = require('fs');

const HANDLES = {
    'NCERT Official': '@ncertofficial',
    'DIKSHA': '@dikshabharat',
    'IGNOU': '@ignou',
    'CEC-UGC': '@cecgurukul',
    'eGyanKosh': '@egyankoshignou',
    'PM_eVidya': '@pm_evidya',
    'Khan Academy India': '@khanacademyindia',
    'Unacademy': '@unacademy',
    'Ministry of Education India': '@eduminofindia'
};

async function getChannelIdFromHandle(handle) {
    return new Promise((resolve, reject) => {
        https.get(`https://www.youtube.com/${handle}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Look for {"channelId":"UC..."}
                const match = /"channelId":"(UC[a-zA-Z0-9_-]{22})"/g.exec(data);
                if (match && match[1]) {
                    resolve(match[1]);
                } else {
                    // Alternative metadata regex
                    const metaMatch = /<meta itemprop="identifier" content="(UC[a-zA-Z0-9_-]{22})">/.exec(data);
                    if (metaMatch && metaMatch[1]) {
                        resolve(metaMatch[1]);
                    } else {
                        resolve('NOT_FOUND');
                    }
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log('Resolving real Channel IDs from handles...');
    const map = {};
    for (const [name, handle] of Object.entries(HANDLES)) {
        try {
            const id = await getChannelIdFromHandle(handle);
            console.log(`${name} (${handle}) -> ${id}`);
            map[name] = id;
        } catch (e) {
            console.log(`${name} (${handle}) -> ERROR: ${e.message}`);
        }
    }
}

run();
