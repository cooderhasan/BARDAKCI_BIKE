const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsDir = path.join(__dirname, '..', 'public', 'fonts');
if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
}

const fonts = [
    {
        name: 'NotoSans-Regular.ttf',
        url: 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf'
    },
    {
        name: 'NotoSans-Bold.ttf',
        url: 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf'
    }
];

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function main() {
    for (const font of fonts) {
        const dest = path.join(fontsDir, font.name);
        console.log(`Downloading ${font.name} from ${font.url}...`);
        try {
            await downloadFile(font.url, dest);
            console.log(`Successfully downloaded ${font.name}`);
        } catch (err) {
            console.error(`Failed to download ${font.name}:`, err.message);
            // Try fallback URL if the primary one fails
            const fallbackUrl = font.name.includes('Bold') 
                ? 'https://fonts.gstatic.com/s/notosans/v36/o-0OIpQlx3QUlC5A4PNr4DRFSfjM7w.ttf'
                : 'https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNr5TRA.ttf';
            console.log(`Trying fallback for ${font.name}: ${fallbackUrl}...`);
            try {
                await downloadFile(fallbackUrl, dest);
                console.log(`Successfully downloaded ${font.name} from fallback`);
            } catch (fallbackErr) {
                console.error(`Failed fallback for ${font.name}:`, fallbackErr.message);
            }
        }
    }
}

main();
