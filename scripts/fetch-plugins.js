import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import * as cheerio from 'cheerio';

function parseGithubRepo(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const match = urlStr.match(/github\.com\/([^\/]+)\/([^\/#\?]+)/i);
  if (match) {
    const user = match[1];
    let repo = match[2];
    if (repo.endsWith('.git')) repo = repo.slice(0, -4);
    return { user, repo };
  }
  return null;
}

function extractBoothItemId(urlStr) {
  if (!urlStr) return null;
  const match = urlStr.match(/booth\.pm\/(?:[a-z]{2}\/)?items\/(\d+)/i) || urlStr.match(/\/items\/(\d+)/i);
  return match ? match[1] : null;
}

function mapTopicsToCategory(topics) {
  const t = topics.join(' ').toLowerCase();
  if (t.includes('effect') || t.includes('エフェクト')) return 'エフェクト';
  if (t.includes('transition') || t.includes('トランジション') || t.includes('scene')) return 'トランジション';
  if (t.includes('item') || t.includes('アイテム') || t.includes('object')) return 'アイテム';
  return 'その他 (GitHub)';
}

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/yaml,text/plain,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
};

async function main() {
  console.log('Fetching YMM4 plugins data at build time...');

  // 1. Fetch YMM4 latest version from manjubox RSS or GitHub releases/tags
  let ymm4Version = '不明';
  try {
    const rssRes = await fetch('https://manjubox.net/rss.xml', { headers: COMMON_HEADERS });
    if (rssRes.ok) {
      const xmlText = await rssRes.text();
      const match = xmlText.match(/ゆっくりMovieMaker\s+(?:v|ver\.?)?\s*([4-9]\.\d+(?:\.\d+)?(?:\.\d+)?)/i) || xmlText.match(/v?4\.\d+(?:\.\d+)?(?:\.\d+)?/i);
      if (match) {
        let ver = match[1] || match[0];
        if (!ver.toLowerCase().startsWith('v')) ver = 'v' + ver;
        ymm4Version = ver;
        console.log(`Fetched YMM4 latest version from RSS: ${ymm4Version}`);
      }
    }
  } catch (e) {
    console.warn('Failed to fetch YMM4 version from RSS:', e.message);
  }

  if (ymm4Version === '不明') {
    try {
      const tagsRes = await fetch('https://api.github.com/repos/manju-summoner/YukkuriMovieMaker4/tags', {
        headers: { ...COMMON_HEADERS, 'Accept': 'application/vnd.github+json' }
      });
      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        if (Array.isArray(tags) && tags.length > 0 && tags[0].name) {
          let ver = tags[0].name.trim();
          if (!ver.toLowerCase().startsWith('v')) ver = 'v' + ver;
          ymm4Version = ver;
          console.log(`Fetched YMM4 latest version from GitHub tags: ${ymm4Version}`);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch YMM4 version from GitHub tags:', e.message);
    }
  }

  // 2. Fetch ymm4plugins.yml and github/list
  let yamlText = '';
  try {
    const res = await fetch('https://manjubox.net/ymm4plugins.yml', { headers: COMMON_HEADERS });
    if (res.ok) {
      yamlText = await res.text();
      console.log(`Fetched ymm4plugins.yml successfully (${yamlText.length} bytes).`);
    } else {
      console.error(`Failed to fetch ymm4plugins.yml, status: ${res.status}`);
    }
  } catch (e) {
    console.error('Failed to fetch ymm4plugins.yml:', e);
  }

  let githubList = [];
  try {
    const res = await fetch('https://manjubox.net/api/ymm4plugins/github/list', { headers: COMMON_HEADERS });
    if (res.ok) {
      githubList = await res.json();
      console.log(`Fetched github/list successfully (${githubList.length} items).`);
    } else {
      console.error(`Failed to fetch github/list, status: ${res.status}`);
    }
  } catch (e) {
    console.error('Failed to fetch github/list:', e);
  }

  let yamlRawData = null;
  if (yamlText) {
    try {
      yamlRawData = yaml.parse(yamlText);
    } catch (e) {
      console.error('Failed to parse YAML:', e);
    }
  }

  const ghMap = new Map();
  if (Array.isArray(githubList)) {
    for (const item of githubList) {
      if (item.user && item.repo) {
        ghMap.set(`${item.user.toLowerCase()}/${item.repo.toLowerCase()}`, item);
      } else if (item.full_name) {
        ghMap.set(item.full_name.toLowerCase(), item);
      }
    }
  }

  let rawPluginsList = [];
  if (Array.isArray(yamlRawData)) {
    rawPluginsList = yamlRawData;
  } else if (yamlRawData && typeof yamlRawData === 'object') {
    if (Array.isArray(yamlRawData.plugins)) {
      rawPluginsList = yamlRawData.plugins;
    } else {
      rawPluginsList = Object.values(yamlRawData);
    }
  }

  const normalizedPlugins = rawPluginsList.map((item, idx) => {
    const id = item.id || `plugin-${idx}-${Date.now()}`;
    const name = item.name || item.title || item.plugin_name || '無題プラグイン';
    const author = item.author || item.creator || item.user || '不明';
    const type = item.type || item.category || 'その他';
    const description = item.description || item.desc || item.summary || '';
    const url = item.url || item.website || item.homepage || '';
    
    let links = [];
    if (Array.isArray(item.links)) {
      links = item.links;
    } else if (typeof item.links === 'object' && item.links !== null) {
      links = Object.entries(item.links).map(([key, val]) => ({ name: key, url: val }));
    } else if (typeof item.links === 'string') {
      links = [item.links];
    }

    let ghInfo = parseGithubRepo(url);
    if (!ghInfo) {
      for (const l of links) {
        const linkUrl = typeof l === 'string' ? l : (l.url || l.href || '');
        const parsed = parseGithubRepo(linkUrl);
        if (parsed) {
          ghInfo = parsed;
          break;
        }
      }
    }

    if (!ghInfo && item.github) {
      if (typeof item.github === 'string') {
        ghInfo = parseGithubRepo(item.github);
      } else if (item.github.user && item.github.repo) {
        ghInfo = { user: item.github.user, repo: item.github.repo };
      }
    }

    const isGithub = !!ghInfo;
    const githubUser = ghInfo ? ghInfo.user : null;
    const githubRepo = ghInfo ? ghInfo.repo : null;
    
    let extraGhData = null;
    if (ghInfo) {
      const key = `${ghInfo.user.toLowerCase()}/${ghInfo.repo.toLowerCase()}`;
      extraGhData = ghMap.get(key) || null;
    }

    const rawIsEnabled = item.isEnabled ?? item.enabled ?? item.is_enabled;
    const isEnabled = rawIsEnabled === false || rawIsEnabled === 'false' ? false : true;

    const publishedAt = item.publishedAt || item.published_at || item.createdAt || item.created_at || item.date || item.releaseDate || item.release_date || (extraGhData ? extraGhData.created_at || extraGhData.published_at : '') || '';

    return {
      id: String(id),
      name: String(name),
      author: String(author),
      type: String(type),
      description: String(description),
      url: url ? String(url) : '',
      links: links.map(l => typeof l === 'string' ? { name: 'Link', url: l } : { name: l.name || 'Link', url: l.url || '#' }),
      isGithub,
      githubUser,
      githubRepo,
      version: item.version || (extraGhData ? extraGhData.latest_tag || extraGhData.tag_name : '') || '',
      updatedAt: item.updated_at || item.updatedAt || (extraGhData ? extraGhData.updated_at : '') || '',
      publishedAt,
      isEnabled,
      license: item.license || '',
      tags: Array.isArray(item.tags) ? item.tags : (item.tag ? [item.tag] : []),
      extraGhData
    };
  });

  for (const ghItem of githubList) {
    if (!ghItem.user || !ghItem.repo) continue;
    const exists = normalizedPlugins.some(
      p => p.githubUser?.toLowerCase() === ghItem.user.toLowerCase() && p.githubRepo?.toLowerCase() === ghItem.repo.toLowerCase()
    );
    if (!exists) {
      normalizedPlugins.push({
        id: `gh-${ghItem.user}-${ghItem.repo}`,
        name: ghItem.name || ghItem.repo,
        author: ghItem.user || ghItem.owner || 'GitHub User',
        type: ghItem.type || 'GitHubプラグイン',
        description: ghItem.description || '',
        url: `https://github.com/${ghItem.user}/${ghItem.repo}`,
        links: [{ name: 'GitHub Repo', url: `https://github.com/${ghItem.user}/${ghItem.repo}` }],
        isGithub: true,
        githubUser: ghItem.user,
        githubRepo: ghItem.repo,
        version: ghItem.latest_tag || ghItem.tag_name || '',
        updatedAt: ghItem.updated_at || '',
        publishedAt: ghItem.created_at || ghItem.published_at || '',
        isEnabled: true,
        license: ghItem.license || '',
        tags: Array.isArray(ghItem.tags) ? ghItem.tags : ['GitHub'],
        extraGhData: ghItem
      });
    }
  }

  // Generate sets for deduplication
  const existingGithubKeys = new Set();
  const existingBoothItemIds = new Set();
  const existingUrls = new Set();

  for (const p of normalizedPlugins) {
    if (p.githubUser && p.githubRepo) {
      existingGithubKeys.add(`${p.githubUser.toLowerCase()}/${p.githubRepo.toLowerCase()}`);
    }
    if (p.url) existingUrls.add(p.url.toLowerCase().split('?')[0].replace(/\/$/, ''));
    for (const l of p.links || []) {
      if (l.url) existingUrls.add(l.url.toLowerCase().split('?')[0].replace(/\/$/, ''));
    }
    
    const boothId = extractBoothItemId(p.url);
    if (boothId) existingBoothItemIds.add(boothId);
    for (const l of p.links || []) {
      const bId = extractBoothItemId(l.url);
      if (bId) existingBoothItemIds.add(bId);
    }
  }

  
  async function fetchBoothHtml(targetUrl) {
    try {
      const direct = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
      if (direct.ok) {
        const text = await direct.text();
        if (text && text.includes('booth.pm')) return text;
      }
    } catch(e) {}

    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
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
      console.log(`Scraping BOOTH: ${boothUrl}`);
      const html = await fetchBoothHtml(boothUrl);
      if (!html) continue;
      const $ = cheerio.load(html);

      $('.item-card, li.l-card').each((idx, el) => {
        const linkEl = $(el).find('a[href*="/items/"]');
        let href = linkEl.attr('href') || '';
        if (href && !href.startsWith('http')) href = `https://booth.pm${href}`;
        
        const dataBrand = $(el).attr('data-product-brand');
        const dataName = $(el).attr('data-product-name');
        const titleEl = $(el).find('.item-card__title, .item-card__name');
        const shopEl = $(el).find('.item-card__shop-name-text, .item-card__shop-name, .item-card__author, .shop-name');
        
        let author = shopEl.text().trim() || dataBrand?.trim() || '';
        if (!author || author === 'BOOTH' || author === 'BOOTHショップ') {
          const subMatch = href.match(/https?:\/\/([a-zA-Z0-9_-]+)\.booth\.pm/i);
          if (subMatch && !['booth', 'ja', 'www'].includes(subMatch[1])) {
            author = subMatch[1];
          }
        }
        if (!author) author = 'BOOTHショップ';
        if (author.toLowerCase().includes('manju-summoner') || author.includes('饅頭遣い')) return;

        const name = titleEl.text().trim() || dataName?.trim();
        const priceAttr = $(el).attr('data-product-price');
        const priceEl = $(el).find('.item-card__price, .price');
        const rawPrice = priceAttr ? `¥ ${priceAttr}` : priceEl.text().trim();
        
        const cleanHref = href.split('?')[0].toLowerCase().replace(/\/$/, '');
        const boothId = extractBoothItemId(cleanHref);
        
        const isDuplicate = existingUrls.has(cleanHref) || (boothId ? existingBoothItemIds.has(boothId) : false);

        if (name && cleanHref && !isDuplicate) {
          existingUrls.add(cleanHref);
          if (boothId) existingBoothItemIds.add(boothId);
          normalizedPlugins.push({
            id: `ext-booth-${boothId || Date.now()}`,
            name: name,
            author: author,
            type: 'Booth自動取得',
            description: `BOOTHで「YMM4Plugin」等のタグで出品されている作品です。${rawPrice ? ` (価格: ${rawPrice})` : ''}`,
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
              const text = $(el).text().replace(/[^\d]/g, '');
              const num = parseInt(text, 10);
              if (!isNaN(num) && num < minPrice) minPrice = num;
           });
           if (minPrice !== Infinity) {
             p.price = `¥ ${minPrice}`;
           } else {
             const metaPrice = $('meta[property="product:price:amount"]').attr('content');
             if (metaPrice) {
                const num = parseInt(metaPrice.replace(/[^\d]/g, ''), 10);
                if (!isNaN(num)) p.price = `¥ ${num}`;
             }
           }
        }
      } catch (e) {}
    }));
  }
const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputData = {
    success: true,
    timestamp: new Date().toISOString(),
    ymm4Version: ymm4Version,
    plugins: normalizedPlugins
  };
  fs.writeFileSync(path.join(publicDir, 'plugins-data.json'), JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`Successfully generated public/plugins-data.json with ${normalizedPlugins.length} plugins.`);
}

main().catch(err => {
  console.error('Error generating plugins data:', err);
});
