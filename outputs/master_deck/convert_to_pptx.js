const pptxgen = require('pptxgenjs');
const html2pptx = require('/Users/sargupta/SahayakAIV2/sahayakai/.agent/skills/pptx/scripts/html2pptx.js');
const path = require('path');

async function createPresentation() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Abhishek Gupta';
    pptx.title = 'SahayakAI Master Introduction';
    pptx.subject = 'SahayakAI Research Collaboration Deck';

    const slidesDir = path.join(__dirname, 'slides');

    // Process all 8 slides
    for (let i = 1; i <= 8; i++) {
        const slideNum = i.toString().padStart(2, '0');
        const htmlFile = path.join(slidesDir, `slide_${slideNum}.html`);

        console.log(`Processing slide ${i}/8: ${htmlFile}`);

        try {
            await html2pptx(htmlFile, pptx);
        } catch (error) {
            console.error(`Error processing slide ${i}:`, error.message);
            throw error;
        }
    }

    // Save the presentation
    const outputFile = path.join(__dirname, 'SahayakAI_Master_Introduction.pptx');
    await pptx.writeFile({ fileName: outputFile });

    console.log(`\nPresentation created successfully: ${outputFile}`);
}

createPresentation().catch(error => {
    console.error('Failed to create presentation:', error);
    process.exit(1);
});
