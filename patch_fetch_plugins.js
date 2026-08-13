import fs from 'fs';
let content = fs.readFileSync('scripts/fetch-plugins.js', 'utf8');

const newLogic = `
  async function fetchBoothHtml(targetUrl) {
    try {
      const direct = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
      if (direct.ok) {
        const text = await direct.text();
        if (text && text.includes('booth.pm')) return text;
      }
    } catch(e) {}

    const proxies = [
      \`https://api.allorigins.win/raw?url=\${encodeURIComponent(targetUrl)}\`,
      \`https://corsproxy.io/?\${encodeURIComponent(targetUrl)}\`
    ];
    for (const proxy of proxies) {
      try {
        const pRes = await fetch(proxy);
        if (pRes.ok) {
          const text = await pRes.text();
          if (text && text.includes('booth.pm')) return text;
        }
      } catch(e) {}
    }
    return null;
  }

  try {
    const boothUrls = [
      'https://booth.pm/ja/items?tags%5B%5D=YMM4Plugin',
      'https://booth.pm/ja/items?tags%5B%5D=ymm-plugin',
      'https://booth.pm/ja/items?tags%5B%5D=ymm4-plugin'
    ];

    for (const boothUrl of boothUrls) {
      console.log(\`Scraping BOOTH: \${boothUrl}\`);
      const html = await fetchBoothHtml(boothUrl);
      if (!html) continue;
      const $ = cheerio.load(html);

      $('.item-card, li.l-card').each((idx, el) => {
        const linkEl = $(el).find('a[href*="/items/"]');
        let href = linkEl.attr('href') || '';
        if (href && !href.startsWith('http')) href = \`https://booth.pm\${href}\`;
        
        const dataBrand = $(el).attr('data-product-brand');
        const dataName = $(el).attr('data-product-name');
        const titleEl = $(el).find('.item-card__title, .item-card__name');
        const shopEl = $(el).find('.item-card__shop-name-text, .item-card__shop-name, .item-card__author, .shop-name');
        
        let author = shopEl.text().trim() || dataBrand?.trim() || '';
        if (!author || author === 'BOOTH' || author === 'BOOTHショップ') {
          const subMatch = href.match(/https?:\\/\\/([a-zA-Z0-9_-]+)\\.booth\\.pm/i);
          if (subMatch && !['booth', 'ja', 'www'].includes(subMatch[1])) {
            author = subMatch[1];
          }
        }
        if (!author) author = 'BOOTHショップ';
        if (author.toLowerCase().includes('manju-summoner') || author.includes('饅頭遣い')) return;

        const name = titleEl.text().trim() || dataName?.trim();
        const priceAttr = $(el).attr('data-product-price');
        const priceEl = $(el).find('.item-card__price, .price');
        const rawPrice = priceAttr ? \`¥ \${priceAttr}\` : priceEl.text().trim();
        
        const cleanHref = href.split('?')[0].toLowerCase().replace(/\\/$/, '');
        const boothId = extractBoothItemId(cleanHref);
        
        const isDuplicate = existingUrls.has(cleanHref) || (boothId ? existingBoothItemIds.has(boothId) : false);

        if (name && cleanHref && !isDuplicate) {
          existingUrls.add(cleanHref);
          if (boothId) existingBoothItemIds.add(boothId);
          normalizedPlugins.push({
            id: \`ext-booth-\${boothId || Date.now()}\`,
            name: name,
            author: author,
            type: 'Booth自動取得',
            description: \`BOOTHで「YMM4Plugin」等のタグで出品されている作品です。\${rawPrice ? \` (価格: \${rawPrice})\` : ''}\`,
            price: rawPrice || undefined,
            url: href,
            links: [{ name: 'BOOTH 商品ページ', url: href }],
            isGithub: false,
            githubUser: null,
            githubRepo: null,
            isEnabled: true,
            tags: ['YMM4Plugin', 'BOOTH', '外部検索'],
            isExternalSource: true,
            sourceName: 'BOOTH'
          });
        }
      });
    }
  } catch (err) {
    console.warn('Failed BOOTH scrape in build:', err.message);
  }

  console.log('Fetching BOOTH prices for all existing BOOTH links...');
  const pluginsToFetch = normalizedPlugins.filter(p => !p.price && (p.url?.includes('booth.pm') || p.links?.some(l => l.url?.includes('booth.pm'))));
  
  const limit = 5;
  for (let i = 0; i < pluginsToFetch.length; i += limit) {
    const chunk = pluginsToFetch.slice(i, i + limit);
    await Promise.all(chunk.map(async (p) => {
      let boothUrl = p.url?.includes('booth.pm') ? p.url : p.links.find(x => x.url?.includes('booth.pm'))?.url;
      if (!boothUrl) return;
      try {
        const bHtml = await fetchBoothHtml(boothUrl);
        if (bHtml) {
           const $ = cheerio.load(bHtml);
           let minPrice = Infinity;
           $('.price, .item-price, .variation-price').each((_, el) => {
              const text = $(el).text().replace(/[^\\d]/g, '');
              const num = parseInt(text, 10);
              if (!isNaN(num) && num < minPrice) minPrice = num;
           });
           if (minPrice !== Infinity) {
             p.price = \`¥ \${minPrice}\`;
           } else {
             const metaPrice = $('meta[property="product:price:amount"]').attr('content');
             if (metaPrice) {
                const num = parseInt(metaPrice.replace(/[^\\d]/g, ''), 10);
                if (!isNaN(num)) p.price = \`¥ \${num}\`;
             }
           }
        }
      } catch (e) {}
    }));
  }
`;

content = content.replace(/\/\/ Scrape BOOTH Search[\s\S]*?(?=const publicDir = path\.resolve)/, newLogic);
fs.writeFileSync('scripts/fetch-plugins.js', content, 'utf8');
