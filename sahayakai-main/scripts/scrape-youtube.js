const https = require('https');

function searchYouTube(query) {
    return new Promise((resolve, reject) => {
        const encodedQuery = encodeURIComponent(query);
        const options = {
            hostname: 'www.youtube.com',
            path: `/results?search_query=${encodedQuery}`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Regex to find video IDs in the initial data JSON
                const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
                const ids = new Set();
                let match;
                while ((match = regex.exec(data)) !== null) {
                    ids.add(match[1]);
                }
                resolve(Array.from(ids).slice(0, 10)); // Take top 10 unique IDs
            });
        }).on('error', reject);
    });
}

async function run() {
    const queries = [
        "NCERT Nishtha Teacher Training Module",
        "Teach for India classroom management",
        "NEP 2020 Teacher training pedagogy",
        "CBSE capacity building program for teachers"
    ];

    for (const q of queries) {
        console.log(`\nQuery: ${q}`);
        try {
            const ids = await searchYouTube(q);
            for (const id of ids) {
                console.log(`  https://www.youtube.com/watch?v=${id}`);
            }
        } catch (e) {
            console.error("Error:", e);
        }
    }
}

run();
