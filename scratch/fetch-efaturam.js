async function main() {
    const r = await fetch('https://developers.trendyolefaturam.com/docs/api-entegrasyon-adimlari');
    const text = await r.text();
    console.log(text.substring(0, 1000));
}
main();
