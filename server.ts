import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import yaml from 'yaml';
import fs from 'fs';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Directories & Persistent Storage Setup ---
  const DATA_DIR = path.join(process.cwd(), 'data');
  const READMES_DIR = path.join(DATA_DIR, 'readmes');
  const DB_FILE = path.join(DATA_DIR, 'plugins-db.json');
  const PUBLIC_DB_FILE = path.join(process.cwd(), 'public', 'plugins-data.json');
  const BOOTH_CACHE_FILE = path.join(DATA_DIR, 'booth-cache.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(READMES_DIR)) {
    fs.mkdirSync(READMES_DIR, { recursive: true });
  }
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // --- In-Memory State ---
  let pluginsDatabase: {
    success: boolean;
    timestamp: string;
    ymm4Version: string;
    plugins: any[];
    syncStats?: { added: number; updated: number; unchanged: number; lastSync: string };
  } = {
    success: true,
    timestamp: new Date().toISOString(),
    ymm4Version: '不明',
    plugins: [],
    syncStats: { added: 0, updated: 0, unchanged: 0, lastSync: new Date().toISOString() }
  };

  let boothCache: Record<string, {
    author: string;
    title?: string;
    price?: string;
    description?: string;
    images?: string[];
    cachedAt: string;
  }> = {};

  // Load BOOTH cache from disk if available
  try {
    if (fs.existsSync(BOOTH_CACHE_FILE)) {
      const raw = fs.readFileSync(BOOTH_CACHE_FILE, 'utf-8');
      boothCache = JSON.parse(raw) || {};
    }
  } catch (err) {
    console.warn('[Storage] Failed to read booth-cache.json:', err);
  }

  // Load existing database from disk (data/plugins-db.json or public/plugins-data.json)
  try {
    let loaded = false;
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.plugins) && parsed.plugins.length > 0) {
        pluginsDatabase = parsed;
        loaded = true;
        console.log(`[Storage] Loaded ${parsed.plugins.length} plugins from data/plugins-db.json`);
      }
    }
    if (!loaded && fs.existsSync(PUBLIC_DB_FILE)) {
      const raw = fs.readFileSync(PUBLIC_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.plugins) && parsed.plugins.length > 0) {
        pluginsDatabase = parsed;
        console.log(`[Storage] Loaded ${parsed.plugins.length} plugins from public/plugins-data.json`);
      }
    }
  } catch (err) {
    console.warn('[Storage] Error loading initial database from disk:', err);
  }

  // Helper to save BOOTH cache
  function saveBoothCache() {
    try {
      fs.writeFileSync(BOOTH_CACHE_FILE, JSON.stringify(boothCache, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[Storage] Failed to save booth-cache.json:', err);
    }
  }

  // Helper to save Plugins Database atomically
  function savePluginsDatabase(stats?: { added: number; updated: number; unchanged: number }) {
    try {
      if (stats) {
        pluginsDatabase.syncStats = {
          ...stats,
          lastSync: new Date().toISOString()
        };
      }
      pluginsDatabase.timestamp = new Date().toISOString();
      const content = JSON.stringify(pluginsDatabase, null, 2);
      fs.writeFileSync(DB_FILE, content, 'utf-8');
      fs.writeFileSync(PUBLIC_DB_FILE, content, 'utf-8');
      console.log(`[Storage] Saved database (${pluginsDatabase.plugins.length} items) to disk and public folder.`);
    } catch (err) {
      console.error('[Storage] Error saving plugins database:', err);
    }
  }

  // Helper to extract GitHub user and repo from a URL string
  function parseGithubRepo(urlStr: string): { user: string; repo: string } | null {
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

  // Helper to extract BOOTH Item ID from URL
  function extractBoothItemId(urlStr: string): string | null {
    if (!urlStr || typeof urlStr !== 'string') return null;
    const match = urlStr.match(/booth\.pm\/(?:[a-z]{2}\/)?items\/(\d+)/i) || urlStr.match(/\/items\/(\d+)/i);
    return match ? match[1] : null;
  }

  // Helper to map GitHub topics to YMM4 Plugin categories
  function mapTopicsToCategory(topics: string[] = []): string {
    if (!topics || topics.length === 0) return 'その他';
    const lower = topics.map((t) => t.toLowerCase().trim());
    const categories: string[] = [];

    for (const topic of lower) {
      if (topic === 'ymm4-audio-effect') categories.push('音声エフェクト');
      else if (topic === 'ymm4-video-effect' || topic === 'ymm4-effect') categories.push('映像エフェクト');
      else if (topic === 'ymm4-transition') categories.push('トランジション');
      else if (topic === 'ymm4-shape') categories.push('図形');
      else if (topic === 'ymm4-tachie') categories.push('立ち絵');
      else if (topic === 'ymm4-video-source') categories.push('動画アイテム');
      else if (topic === 'ymm4-image-source') categories.push('画像アイテム');
      else if (topic === 'ymm4-audio-source' || topic === 'ymm4-voice') categories.push('音声');
      else if (topic === 'ymm4-video-writer' || topic === 'ymm4-video-exporter' || topic === 'ymm4-exporter') categories.push('映像出力');
      else if (topic === 'ymm4-text-completion') categories.push('テキスト');
      else if (topic === 'ymm4-importer') categories.push('インポーター');
    }

    const unique = Array.from(new Set(categories));
    return unique.length > 0 ? unique.join('、') : 'その他';
  }

  // Key generator for unified deduplication & matching
  function getPluginKey(p: any): string {
    if (p.githubUser && p.githubRepo) {
      return `gh:${p.githubUser.toLowerCase()}/${p.githubRepo.toLowerCase()}`;
    }
    const boothId = extractBoothItemId(p.url);
    if (boothId) {
      return `booth:${boothId}`;
    }
    if (p.url) {
      return `url:${p.url.split('?')[0].split('#')[0].toLowerCase().replace(/\/$/, '')}`;
    }
    return `id:${p.id}`;
  }

  // --- Core Sync & Diff Engine ---
  let isSyncing = false;

  async function syncAndDiffPlugins(options: { force?: boolean } = {}) {
    if (isSyncing) return pluginsDatabase;
    isSyncing = true;
    console.log('[Sync Engine] Starting plugins data synchronization & diff check...');

    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/yaml,text/plain,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      };

      // 1. Fetch latest YMM4 version
      let ymm4Version = pluginsDatabase.ymm4Version || '不明';
      try {
        const rssRes = await fetch('https://manjubox.net/rss.xml', { headers }).catch(() => null);
        if (rssRes && rssRes.ok) {
          const xmlText = await rssRes.text();
          const match = xmlText.match(/ゆっくりMovieMaker\s+(?:v|ver\.?)?\s*([4-9]\.\d+(?:\.\d+)?(?:\.\d+)?)/i)
            || xmlText.match(/v?4\.\d+(?:\.\d+)?(?:\.\d+)?/i);
          if (match) {
            let ver = match[1] || match[0];
            if (!ver.toLowerCase().startsWith('v')) ver = 'v' + ver;
            ymm4Version = ver;
          }
        }
      } catch (e) {
        console.warn('[Sync] Failed to fetch YMM4 version from RSS:', e);
      }

      // 2. Fetch YAML & GitHub list from manjubox
      const [ymlRes, ghListRes] = await Promise.allSettled([
        fetch('https://manjubox.net/ymm4plugins.yml', { headers }),
        fetch('https://manjubox.net/api/ymm4plugins/github/list', { headers })
      ]);

      let yamlRawData: any = null;
      if (ymlRes.status === 'fulfilled' && ymlRes.value.ok) {
        const text = await ymlRes.value.text();
        try {
          yamlRawData = yaml.parse(text);
        } catch (err) {
          console.error('[Sync] YAML parse error:', err);
        }
      }

      let githubList: any[] = [];
      if (ghListRes.status === 'fulfilled' && ghListRes.value.ok) {
        try {
          githubList = await ghListRes.value.json();
        } catch (err) {
          console.error('[Sync] GitHub list JSON parse error:', err);
        }
      }

      const ghMap = new Map<string, any>();
      if (Array.isArray(githubList)) {
        for (const item of githubList) {
          if (item.user && item.repo) {
            ghMap.set(`${item.user.toLowerCase()}/${item.repo.toLowerCase()}`, item);
          } else if (item.full_name) {
            ghMap.set(item.full_name.toLowerCase(), item);
          }
        }
      }

      let rawPluginsList: any[] = [];
      if (Array.isArray(yamlRawData)) {
        rawPluginsList = yamlRawData;
      } else if (yamlRawData && typeof yamlRawData === 'object') {
        rawPluginsList = Array.isArray(yamlRawData.plugins) ? yamlRawData.plugins : Object.values(yamlRawData);
      }

      const fetchedFreshPlugins: any[] = [];

      // Process YAML official list items
      rawPluginsList.forEach((item: any, idx: number) => {
        const id = item.id || `plugin-${idx}-${Date.now()}`;
        const name = item.name || item.title || item.plugin_name || '無題プラグイン';
        const author = item.author || item.creator || item.user || '不明';
        const type = item.type || item.category || 'その他';
        const description = item.description || item.desc || item.summary || '';
        const url = item.url || item.website || item.homepage || '';

        let links: any[] = [];
        if (Array.isArray(item.links)) {
          links = item.links;
        } else if (typeof item.links === 'object' && item.links !== null) {
          links = Object.entries(item.links).map(([key, val]) => ({ name: key, url: val }));
        } else if (typeof item.links === 'string') {
          links = [item.links];
        }

        let ghInfo: { user: string; repo: string } | null = parseGithubRepo(url);
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

        fetchedFreshPlugins.push({
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
        });
      });

      // Process GitHub list items not in YAML
      for (const ghItem of githubList) {
        if (!ghItem.user || !ghItem.repo) continue;
        const exists = fetchedFreshPlugins.some(
          p => p.githubUser?.toLowerCase() === ghItem.user.toLowerCase() && p.githubRepo?.toLowerCase() === ghItem.repo.toLowerCase()
        );
        if (!exists) {
          fetchedFreshPlugins.push({
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

      // Build deduplication sets from fresh YAML/official list to prevent duplicates
      const officialGhKeys = new Set<string>();
      const officialBoothIds = new Set<string>();
      const officialUrls = new Set<string>();

      for (const p of fetchedFreshPlugins) {
        if (p.githubUser && p.githubRepo) {
          officialGhKeys.add(`${p.githubUser.toLowerCase()}/${p.githubRepo.toLowerCase()}`);
        }
        if (p.url) {
          const bId = extractBoothItemId(p.url);
          if (bId) officialBoothIds.add(bId);
          officialUrls.add(p.url.split('?')[0].split('#')[0].toLowerCase().replace(/\/$/, ''));
        }
        for (const l of p.links || []) {
          if (l.url) {
            const bId = extractBoothItemId(l.url);
            if (bId) officialBoothIds.add(bId);
            officialUrls.add(l.url.split('?')[0].split('#')[0].toLowerCase().replace(/\/$/, ''));
          }
        }
      }

      // 3. Search External GitHub - STRICTLY topic:ymm4-plugin ONLY (Never search title/description)
      try {
        const ghSearchQueries = [
          'q=topic:ymm4-plugin'
        ];

        for (const q of ghSearchQueries) {
          try {
            const ghRes = await fetch(`https://api.github.com/search/repositories?${q}&per_page=50`, {
              headers: { 'User-Agent': 'YMM4-Plugin-Portal-Server', 'Accept': 'application/vnd.github+json' }
            });
            if (ghRes.ok) {
              const data = await ghRes.json();
              if (data && Array.isArray(data.items)) {
                for (const item of data.items) {
                  if (!item.owner || !item.name) continue;
                  const ownerLogin = item.owner.login.toLowerCase();
                  if (ownerLogin === 'manju-summoner') continue;

                  // STRICT REQUIREMENT: Topic MUST contain 'ymm4-plugin' (never match by name/description)
                  const itemTopics: string[] = Array.isArray(item.topics) ? item.topics : [];
                  const hasYmm4PluginTopic = itemTopics.some((t: string) => t.toLowerCase() === 'ymm4-plugin');
                  if (!hasYmm4PluginTopic) continue;

                  const key = `${ownerLogin}/${item.name.toLowerCase()}`;
                  const htmlUrl = (item.html_url || `https://github.com/${item.owner.login}/${item.name}`).toLowerCase();

                  if (officialGhKeys.has(key) || officialUrls.has(htmlUrl)) continue;

                  officialGhKeys.add(key);
                  officialUrls.add(htmlUrl);

                  const pluginType = mapTopicsToCategory(itemTopics);

                  fetchedFreshPlugins.push({
                    id: `ext-gh-${item.id || `${item.owner.login}-${item.name}`}`,
                    name: item.name,
                    author: item.owner.login,
                    type: pluginType,
                    description: item.description || 'GitHubで公開されているYMM4プラグインです。',
                    url: item.html_url,
                    links: [{ name: 'GitHub Repo', url: item.html_url }],
                    isGithub: true,
                    githubUser: item.owner.login,
                    githubRepo: item.name,
                    version: item.default_branch || 'main',
                    updatedAt: item.updated_at || '',
                    publishedAt: item.created_at || '',
                    isEnabled: true,
                    license: item.license?.spdx_id || item.license?.name || '',
                    tags: itemTopics.length > 0 ? itemTopics : ['ymm4-plugin', 'GitHub', '外部検索'],
                    isExternalSource: true,
                    sourceName: 'GitHub'
                  });
                }
              }
            }
          } catch (e) {
            console.warn(`[Sync] GitHub search error for query ${q}:`, e);
          }
        }
      } catch (err) {
        console.warn('[Sync] External GitHub search caught error:', err);
      }

      // 4. Search External BOOTH
      try {
        const boothUrls = [
          'https://booth.pm/ja/items?tags%5B%5D=YMM4Plugin',
          'https://booth.pm/ja/items?tags%5B%5D=ymm4-plugin'
        ];

        for (const boothUrl of boothUrls) {
          try {
            const bRes = await fetch(boothUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
              }
            }).catch(() => null);

            if (!bRes || !bRes.ok) continue;
            const html = await bRes.text();

            const cardChunks = html.split(/<li[^>]*class=["'][^"']*(?:item-card|l-card|js-item-card)/i).slice(1);
            for (const cardChunk of cardChunks) {
              const cardHtml = cardChunk.substring(0, cardChunk.indexOf('</li>'));
              const idMatch = cardHtml.match(/data-product-id=["'](\d+)["']/i) || cardHtml.match(/\/items\/(\d+)/i);
              if (!idMatch) continue;
              const itemId = idMatch[1];

              if (officialBoothIds.has(itemId)) continue;

              const hrefMatch = cardHtml.match(/href=["']([^"']*(?:booth\.pm)?\/(?:[a-z]{2}\/)?items\/\d+[^"']*)["']/i);
              let fullUrl = hrefMatch ? hrefMatch[1] : `https://booth.pm/ja/items/${itemId}`;
              if (!fullUrl.startsWith('http')) {
                fullUrl = `https://booth.pm${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
              }

              let author = '';
              const shopDivMatch = cardHtml.match(/class=["'][^"']*(?:item-card__shop-name|shop-name-text|shop-name)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
                || cardHtml.match(/class=["'][^"']*(?:item-card__shop-name-anchor|shop-info)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
              const dataBrandMatch = cardHtml.match(/data-product-brand=["']([^"']+)["']/i);

              if (shopDivMatch) author = shopDivMatch[1].replace(/<[^>]+>/g, '').trim();
              else if (dataBrandMatch) author = dataBrandMatch[1].trim();

              if (!author || author === 'BOOTHショップ') {
                const subMatch = fullUrl.match(/https?:\/\/([a-zA-Z0-9_-]+)\.booth\.pm/i);
                if (subMatch && !['booth', 'ja', 'www'].includes(subMatch[1])) {
                  author = subMatch[1];
                }
              }
              if (!author) author = 'BOOTHショップ';

              if (author.toLowerCase().includes('manju-summoner') || author.includes('饅頭遣い')) continue;

              let title = '';
              const titleAnchor = cardHtml.match(/class=["'][^"']*(?:item-card__title|item-card__name|title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|h\d|span|a)>/i);
              const dataNameMatch = cardHtml.match(/data-product-name=["']([^"']+)["']/i);
              if (titleAnchor) title = titleAnchor[1].replace(/<[^>]+>/g, '').trim();
              else if (dataNameMatch) title = dataNameMatch[1].trim();

              let price = '';
              const priceMatch = cardHtml.match(/data-product-price=["']([^"']+)["']/i)
                || cardHtml.match(/class=["'][^"']*(?:price|item-card__price|item-price)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i);
              if (priceMatch) {
                const rawPrice = priceMatch[1].replace(/<[^>]+>/g, '').trim();
                const num = parseInt(rawPrice.replace(/[^\d]/g, ''), 10);
                if (!isNaN(num)) {
                  price = num === 0 ? '無料' : `¥ ${num.toLocaleString()}`;
                } else {
                  price = rawPrice;
                }
              }

              const cleanUrl = fullUrl.split('?')[0].toLowerCase().replace(/\/$/, '');
              if (officialUrls.has(cleanUrl)) continue;

              officialBoothIds.add(itemId);
              officialUrls.add(cleanUrl);

              fetchedFreshPlugins.push({
                id: `ext-booth-${itemId}`,
                name: title || `BOOTHアイテム #${itemId}`,
                author,
                type: 'Booth自動取得',
                description: `BOOTHで出品されている作品です。${price ? ` (価格: ${price})` : ''}`,
                price: price || undefined,
                url: fullUrl,
                links: [{ name: 'BOOTH 商品ページ', url: fullUrl }],
                isGithub: false,
                githubUser: null,
                githubRepo: null,
                isEnabled: true,
                tags: ['YMM4Plugin', 'BOOTH', '外部検索'],
                isExternalSource: true,
                sourceName: 'BOOTH'
              });
            }
          } catch (e) {
            console.warn(`[Sync] BOOTH fetch error for ${boothUrl}:`, e);
          }
        }
      } catch (err) {
        console.warn('[Sync] BOOTH search caught error:', err);
      }

      // --- 5. DIFFERENTIAL UPDATE / MERGE LOGIC ---
      const existingMap = new Map<string, any>();
      for (const p of pluginsDatabase.plugins) {
        existingMap.set(getPluginKey(p), p);
      }

      let addedCount = 0;
      let updatedCount = 0;
      let unchangedCount = 0;

      const mergedList: any[] = [];

      // Check all incoming fresh items against existing database
      for (const fresh of fetchedFreshPlugins) {
        const key = getPluginKey(fresh);
        const existing = existingMap.get(key);

        if (!existing) {
          // --- NEW ITEM (新規追加) ---
          addedCount++;
          // Check if we have cached BOOTH info for this new item
          const bId = extractBoothItemId(fresh.url);
          if (bId && boothCache[bId]) {
            if (boothCache[bId].price && !fresh.price) fresh.price = boothCache[bId].price;
            if (boothCache[bId].author && (!fresh.author || fresh.author === '不明')) fresh.author = boothCache[bId].author;
          }
          mergedList.push(fresh);
        } else {
          // --- EXISTING ITEM (比較 & 変更・追加の検知) ---
          let isModified = false;

          const updatedItem = { ...existing };

          // Compare basic fields
          if (fresh.name && fresh.name !== existing.name && fresh.name !== '無題プラグイン') {
            updatedItem.name = fresh.name;
            isModified = true;
          }
          if (fresh.author && fresh.author !== existing.author && fresh.author !== '不明') {
            updatedItem.author = fresh.author;
            isModified = true;
          }
          if (fresh.version && fresh.version !== existing.version) {
            updatedItem.version = fresh.version;
            isModified = true;
          }
          if (fresh.updatedAt && fresh.updatedAt !== existing.updatedAt) {
            updatedItem.updatedAt = fresh.updatedAt;
            isModified = true;
          }
          if (fresh.publishedAt && fresh.publishedAt !== existing.publishedAt) {
            updatedItem.publishedAt = fresh.publishedAt;
            isModified = true;
          }
          if (fresh.price && fresh.price !== existing.price) {
            updatedItem.price = fresh.price;
            isModified = true;
          }
          if (fresh.license && fresh.license !== existing.license) {
            updatedItem.license = fresh.license;
            isModified = true;
          }
          if (fresh.description && fresh.description.length > (existing.description?.length || 0)) {
            updatedItem.description = fresh.description;
            isModified = true;
          }
          if (fresh.extraGhData && !existing.extraGhData) {
            updatedItem.extraGhData = fresh.extraGhData;
            isModified = true;
          }

          // Check BOOTH cache for price/description if existing lacks it
          const bId = extractBoothItemId(updatedItem.url);
          if (bId && boothCache[bId]) {
            if (boothCache[bId].price && !updatedItem.price) {
              updatedItem.price = boothCache[bId].price;
              isModified = true;
            }
          }

          if (isModified) {
            updatedCount++;
            mergedList.push(updatedItem);
          } else {
            unchangedCount++;
            mergedList.push(existing);
          }

          existingMap.delete(key);
        }
      }

      // Preserve any valid existing items that weren't in the latest remote fetch
      for (const [key, leftover] of existingMap.entries()) {
        // Exclude invalid external GitHub items that lack the strict 'ymm4-plugin' topic
        const isExternalGh = (leftover.isExternalSource && leftover.isGithub) || (leftover.id && String(leftover.id).startsWith('ext-gh-'));
        if (isExternalGh) {
          const tags: string[] = Array.isArray(leftover.tags) ? leftover.tags : [];
          const hasYmm4Plugin = tags.some((t: string) => t.toLowerCase() === 'ymm4-plugin');
          if (!hasYmm4Plugin) {
            console.log(`[Sync Engine] Purging non-ymm4-plugin external GitHub repo: ${leftover.name} (${leftover.url})`);
            continue; // Skip / purge this item
          }
        }
        unchangedCount++;
        mergedList.push(leftover);
      }

      // Final sanitization of mergedList: ensure ALL external GitHub items strictly have 'ymm4-plugin'
      const sanitizedList = mergedList.filter((p) => {
        const isExternalGh = (p.isExternalSource && p.isGithub) || (p.id && String(p.id).startsWith('ext-gh-'));
        if (isExternalGh) {
          const tags: string[] = Array.isArray(p.tags) ? p.tags : [];
          return tags.some((t: string) => t.toLowerCase() === 'ymm4-plugin');
        }
        return true;
      });

      const hasChanges = addedCount > 0 || updatedCount > 0 || pluginsDatabase.plugins.length === 0 || sanitizedList.length !== pluginsDatabase.plugins.length;

      pluginsDatabase.plugins = sanitizedList;
      pluginsDatabase.ymm4Version = ymm4Version;

      if (hasChanges || options.force) {
        savePluginsDatabase({ added: addedCount, updated: updatedCount, unchanged: unchangedCount });
        console.log(`[Sync Engine] Diff detected & updated: +${addedCount} added, ~${updatedCount} modified, =${unchangedCount} unchanged. (Total plugins: ${mergedList.length})`);
      } else {
        console.log(`[Sync Engine] No changes detected. Database is up-to-date (${mergedList.length} plugins).`);
      }

      return pluginsDatabase;
    } catch (err: any) {
      console.error('[Sync Engine] Error during synchronization:', err);
      return pluginsDatabase;
    } finally {
      isSyncing = false;
    }
  }

  // Run initial sync on server boot
  setTimeout(() => {
    syncAndDiffPlugins().catch(err => console.error('[Boot Sync Error]', err));
  }, 1000);

  // Periodic automatic background sync every 30 minutes
  setInterval(() => {
    syncAndDiffPlugins().catch(err => console.error('[Periodic Sync Error]', err));
  }, 30 * 60 * 1000);


  // ==========================================
  // --- API Routes ---
  // ==========================================

  // API Route: Get project root README.md content
  app.get('/api/readme', (req, res) => {
    try {
      const readmePath = path.join(process.cwd(), 'README.md');
      if (fs.existsSync(readmePath)) {
        const content = fs.readFileSync(readmePath, 'utf-8');
        res.type('text/markdown; charset=utf-8').send(content);
      } else {
        res.status(404).send('# 読み込みエラー\n\nREADME.mdが見つかりませんでした。');
      }
    } catch (err) {
      console.error('Error reading README.md:', err);
      res.status(500).send('# 読み込みエラー\n\nREADME.mdの読み込みに失敗しました。');
    }
  });

  // API Route: Get or fetch & SAVE GitHub README for any plugin repository
  // Requirement: "readmeもユーザーがサイトアクセスして読み込んだとき保存するように"
  // "あとapi制限なんとか引っかからないように工夫して"
  app.get('/api/ymm4/readme/:user/:repo', async (req, res) => {
    const rawUser = req.params.user;
    const rawRepo = req.params.repo;

    if (!rawUser || !rawRepo) {
      return res.status(400).send('# エラー\n\nリポジトリ情報が不正です。');
    }

    // Sanitize user and repo names for safe disk storage
    const cleanUser = rawUser.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const cleanRepo = rawRepo.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const fileName = `${cleanUser}__${cleanRepo}.md`;
    const filePath = path.join(READMES_DIR, fileName);

    // 1. If README already saved on server disk, return it immediately! (0 API calls, ultra fast)
    try {
      if (fs.existsSync(filePath)) {
        const cachedText = fs.readFileSync(filePath, 'utf-8');
        if (cachedText && cachedText.trim().length > 0) {
          res.setHeader('X-Cache-Status', 'HIT-DISK');
          return res.type('text/markdown; charset=utf-8').send(cachedText);
        }
      }
    } catch (e) {
      console.warn(`[README Cache] Failed to read ${fileName}:`, e);
    }

    // 2. Fetch via raw.githubusercontent.com (NO API rate limit!)
    const candidateRawUrls = [
      `https://raw.githubusercontent.com/${cleanUser}/${cleanRepo}/HEAD/README.md`,
      `https://raw.githubusercontent.com/${cleanUser}/${cleanRepo}/HEAD/README.ja.md`,
      `https://raw.githubusercontent.com/${cleanUser}/${cleanRepo}/HEAD/readme.md`,
      `https://raw.githubusercontent.com/${cleanUser}/${cleanRepo}/main/README.md`,
      `https://raw.githubusercontent.com/${cleanUser}/${cleanRepo}/master/README.md`
    ];

    let foundReadmeText: string | null = null;

    for (const rawUrl of candidateRawUrls) {
      try {
        const response = await fetch(rawUrl, {
          headers: { 'User-Agent': 'YMM4-Plugin-Portal' }
        });
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim().length > 0 && !text.includes('404: Not Found')) {
            foundReadmeText = text;
            break;
          }
        }
      } catch {
        // try next branch
      }
    }

    // 3. Fallback to GitHub REST API only if raw URLs did not succeed
    if (!foundReadmeText) {
      try {
        const apiRes = await fetch(`https://api.github.com/repos/${cleanUser}/${cleanRepo}/readme`, {
          headers: {
            'User-Agent': 'YMM4-Plugin-Portal',
            'Accept': 'application/vnd.github+json'
          }
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data && data.download_url) {
            const rawRes = await fetch(data.download_url);
            if (rawRes.ok) {
              const text = await rawRes.text();
              if (text && text.trim().length > 0) {
                foundReadmeText = text;
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[README] GitHub API fallback failed for ${cleanUser}/${cleanRepo}:`, err);
      }
    }

    // 4. Save fetched README to disk for all future visits
    if (foundReadmeText) {
      try {
        fs.writeFileSync(filePath, foundReadmeText, 'utf-8');
        console.log(`[README Cache] Successfully saved README for ${cleanUser}/${cleanRepo} to ${fileName}`);
      } catch (err) {
        console.warn(`[README Cache] Failed to write ${fileName} to disk:`, err);
      }

      res.setHeader('X-Cache-Status', 'SAVED-TO-DISK');
      return res.type('text/markdown; charset=utf-8').send(foundReadmeText);
    }

    return res.status(404).send('# READMEが見つかりませんでした\n\nこのリポジトリにはREADME.mdが公開されていないか、取得できませんでした。');
  });

  // API Route: Get Plugins Database (Directly from persistent server storage)
  app.get('/api/ymm4/plugins', async (req, res) => {
    try {
      // If force query is specified, trigger fresh sync
      if (req.query.force === 'true') {
        await syncAndDiffPlugins({ force: true });
      }

      res.json({
        success: true,
        count: pluginsDatabase.plugins.length,
        plugins: pluginsDatabase.plugins,
        ymm4Version: pluginsDatabase.ymm4Version,
        timestamp: pluginsDatabase.timestamp,
        syncStats: pluginsDatabase.syncStats
      });
    } catch (error: any) {
      console.error('Error in /api/ymm4/plugins:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get plugins',
        plugins: pluginsDatabase.plugins || []
      });
    }
  });

  // API Route: Trigger sync manually
  app.post('/api/ymm4/sync', async (req, res) => {
    try {
      const result = await syncAndDiffPlugins({ force: true });
      res.json({
        success: true,
        count: result.plugins.length,
        syncStats: result.syncStats,
        timestamp: result.timestamp
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: External plugins list endpoint (backward-compatible)
  app.get('/api/external-plugins', (req, res) => {
    const external = pluginsDatabase.plugins.filter(p => p.isExternalSource);
    res.json({
      success: true,
      count: external.length,
      plugins: external
    });
  });

  // API Route: Proxy file download to bypass CORS and rate limits
  app.get('/api/ymm4/proxy-file', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send('Missing url parameter');
    }
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'YMM4-Plugin-Portal-Server',
          'Accept': 'application/octet-stream, */*'
        }
      });
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
      res.send(buffer);
    } catch (err: any) {
      console.error('Proxy download error:', err);
      res.status(500).send(err.message || 'Proxy error');
    }
  });

  // API Route: Get latest YMM4 version
  app.get('/api/ymm4/latest-version', (req, res) => {
    res.json({
      success: true,
      version: pluginsDatabase.ymm4Version || '不明',
      title: `ゆっくりMovieMaker ${pluginsDatabase.ymm4Version || ''}`.trim(),
      html_url: 'https://manjubox.net/ymm4/'
    });
  });

  // API Route: BOOTH product details with disk caching to avoid rate limits
  app.get('/api/ymm4/booth-detail', async (req, res) => {
    const urlParam = req.query.url as string;
    if (!urlParam || !urlParam.includes('booth.pm')) {
      return res.status(400).json({ success: false, error: 'Invalid BOOTH URL' });
    }

    const itemId = extractBoothItemId(urlParam);

    // 1. Check disk/memory cache (Valid for 7 days)
    if (itemId && boothCache[itemId]) {
      const cached = boothCache[itemId];
      const cacheAge = Date.now() - new Date(cached.cachedAt || 0).getTime();
      if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
        return res.json({
          success: true,
          ...cached,
          fromCache: true
        });
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(urlParam, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
        },
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeout);

      if (!response || !response.ok) {
        // If fetch fails but we have stale cache, return stale cache gracefully
        if (itemId && boothCache[itemId]) {
          return res.json({ success: true, ...boothCache[itemId], fromCache: true });
        }
        return res.status(500).json({ success: false, error: 'Failed to fetch BOOTH page' });
      }

      const html = await response.text();

      let author = '';
      let title = '';

      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      const titleTagMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
      const rawTitleStr = ogTitleMatch ? ogTitleMatch[1] : (titleTagMatch ? titleTagMatch[1] : '');

      if (rawTitleStr) {
        let clean = rawTitleStr.replace(/<[^>]+>/g, '').trim();
        clean = clean.replace(/\s*-\s*BOOTHショップ$/, '').replace(/\s*-\s*BOOTH$/, '').trim();
        const parts = clean.split(' - ');
        if (parts.length >= 2) {
          author = parts[parts.length - 1].trim();
          title = parts.slice(0, parts.length - 1).join(' - ').trim();
        } else {
          title = clean;
        }
      }

      if (!author || author === 'BOOTH' || author === 'BOOTHショップ') {
        const shopMatch = html.match(/class=["'][^"']*(?:shop-name|shop-name-text|merchant-name|item-card__author|item-card__shop-name)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|a|p)>/i)
          || html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i)
          || html.match(/data-shop-name=["']([^"']+)["']/i);

        if (shopMatch) {
          author = shopMatch[1].replace(/<[^>]+>/g, '').trim();
        }
      }

      if (!author || author === 'BOOTH' || author === 'BOOTHショップ') {
        const subMatch = urlParam.match(/https?:\/\/([a-zA-Z0-9_-]+)\.booth\.pm/i);
        if (subMatch && !['booth', 'ja', 'www'].includes(subMatch[1])) {
          author = subMatch[1];
        }
      }

      if (!title) {
        const titleMatch = html.match(/<h2[^>]*class=["'][^"']*(?:text-headline-1|item-name|title)[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
        if (titleMatch) {
          title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s*-\s*BOOTH$/, '').trim();
        }
      }

      let price = '';

      // 1. Prioritize official meta product:price:amount tag
      const metaMatch = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i);
      if (metaMatch) {
        const num = parseInt(metaMatch[1].replace(/[^\d]/g, ''), 10);
        if (!isNaN(num)) {
          price = num === 0 ? '無料' : `¥ ${num.toLocaleString()}`;
        }
      }

      // 2. Fallback to JSON-LD product offers
      if (!price) {
        const jsonLdMatches = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatches) {
          for (const tag of jsonLdMatches) {
            try {
              const rawJson = tag.replace(/<\/?script[^>]*>/gi, '');
              const json = JSON.parse(rawJson);
              const items = Array.isArray(json) ? json : [json];
              for (const item of items) {
                if (item?.offers) {
                  const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
                  for (const offer of offers) {
                    const p = parseInt(String(offer.price || '').replace(/[^\d]/g, ''), 10);
                    if (!isNaN(p)) {
                      price = p === 0 ? '無料' : `¥ ${p.toLocaleString()}`;
                      break;
                    }
                  }
                }
              }
            } catch {}
          }
        }
      }

      // 3. Fallback to variation/item price elements
      if (!price) {
        const priceMatches = html.match(/<(?:div|span|p)[^>]*class=["'][^"']*(?:item-price|variation-price)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/gi);
        
        if (priceMatches && priceMatches.length > 0) {
          let minPrice = Infinity;
          for (const p of priceMatches) {
            const text = p.replace(/<[^>]+>/g, '').trim();
            const num = parseInt(text.replace(/[^\d]/g, ''), 10);
            if (!isNaN(num) && num < minPrice) {
              minPrice = num;
            }
          }
          if (minPrice !== Infinity) {
            price = minPrice === 0 ? '無料' : `¥ ${minPrice.toLocaleString()}`;
          }
        }
      }

      let description = '';
      const descMatch = html.match(/class=["'][^"']*(?:autolink|component-description|item-description|js-autolink)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
        || html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
        || html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);

      if (descMatch) {
        let rawDesc = descMatch[1];
        rawDesc = rawDesc
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<li[^>]*>/gi, '• ')
          .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
            const cleanText = text.replace(/<[^>]+>/g, '').trim() || href;
            return `[${cleanText}](${href})`;
          })
          .replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**')
          .replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, '*$1*')
          .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n### $1\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        description = rawDesc;
      }

      const images: string[] = [];
      const imgRegex = /https:\/\/booth\.pximg\.net\/[a-zA-Z0-9_\-\.\/]+/g;
      let imgMatch;
      while ((imgMatch = imgRegex.exec(html)) !== null) {
        if (!images.includes(imgMatch[0])) {
          images.push(imgMatch[0]);
        }
        if (images.length >= 6) break;
      }

      const result = {
        author: author || 'BOOTHショップ',
        title,
        price,
        description,
        images,
        cachedAt: new Date().toISOString()
      };

      // Save to cache
      if (itemId) {
        boothCache[itemId] = result;
        saveBoothCache();

        // Also update in-memory and disk DB if price was missing
        if (price) {
          const matchedPlugin = pluginsDatabase.plugins.find(p => p.url && p.url.includes(itemId));
          if (matchedPlugin && (!matchedPlugin.price || matchedPlugin.price !== price)) {
            matchedPlugin.price = price;
            if (description && (!matchedPlugin.description || matchedPlugin.description.length < 50)) {
              matchedPlugin.description = description;
            }
            savePluginsDatabase({ added: 0, updated: 1, unchanged: pluginsDatabase.plugins.length - 1 });
          }
        }
      }

      res.json({
        success: true,
        ...result
      });
    } catch (err: any) {
      console.error('Error in /api/ymm4/booth-detail:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: GitHub Release details with download statistics
  app.get('/api/ymm4/github-detail/:user/:repo', async (req, res) => {
    const { user, repo } = req.params;
    try {
      // 1. First priority: manjubox.net API (bypasses GitHub rate limit & includes download counts)
      const url = `https://manjubox.net/api/ymm4plugins/github/detail/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);

      if (response && response.ok) {
        const data = await response.json().catch(() => null);
        if (data && !data.error) {
          let releases: any[] = [];
          if (Array.isArray(data)) {
            releases = data;
          } else if (Array.isArray(data.releases)) {
            releases = data.releases;
          } else if (data.tag_name) {
            releases = [data];
          }

          if (releases.length > 0) {
            // Compute total download statistics
            let totalDownloads = 0;
            const normalizedReleases = releases.map((rel: any) => {
              const assets = Array.isArray(rel.assets) ? rel.assets.map((asset: any) => ({
                id: asset.id,
                name: asset.name,
                size: asset.size || 0,
                download_count: typeof asset.download_count === 'number' ? asset.download_count : 0,
                created_at: asset.created_at || rel.created_at,
                updated_at: asset.updated_at || rel.updated_at,
                browser_download_url: asset.browser_download_url || `https://github.com/${user}/${repo}/releases/download/${rel.tag_name}/${asset.name}`
              })) : [];

              const releaseDlCount = assets.reduce((sum: number, a: any) => sum + (a.download_count || 0), 0);
              totalDownloads += releaseDlCount;

              return {
                ...rel,
                assets,
                release_download_count: releaseDlCount
              };
            });

            return res.json({
              success: true,
              data: {
                user,
                repo,
                total_downloads: totalDownloads,
                releases: normalizedReleases
              }
            });
          }
        }
      }

      // 2. Fallback to GitHub REST API if manjubox didn't have it (e.g. newly added or external repo)
      const ghApiUrl = `https://api.github.com/repos/${user}/${repo}/releases`;
      const ghRes = await fetch(ghApiUrl, {
        headers: { 'User-Agent': 'YMM4-Plugin-Portal' }
      }).catch(() => null);

      if (ghRes && ghRes.ok) {
        const rawReleases = await ghRes.json().catch(() => null);
        if (Array.isArray(rawReleases) && rawReleases.length > 0) {
          let totalDownloads = 0;
          const normalizedReleases = rawReleases.map((rel: any) => {
            const assets = Array.isArray(rel.assets) ? rel.assets.map((asset: any) => ({
              id: asset.id,
              name: asset.name,
              size: asset.size || 0,
              download_count: typeof asset.download_count === 'number' ? asset.download_count : 0,
              created_at: asset.created_at,
              updated_at: asset.updated_at,
              browser_download_url: asset.browser_download_url
            })) : [];

            const releaseDlCount = assets.reduce((sum: number, a: any) => sum + (a.download_count || 0), 0);
            totalDownloads += releaseDlCount;

            return {
              ...rel,
              assets,
              release_download_count: releaseDlCount
            };
          });

          return res.json({
            success: true,
            data: {
              user,
              repo,
              total_downloads: totalDownloads,
              releases: normalizedReleases
            }
          });
        }
      }

      return res.json({
        success: true,
        data: { user, repo, total_downloads: 0, releases: [] }
      });
    } catch (err: any) {
      res.json({
        success: true,
        data: { user, repo, total_downloads: 0, releases: [] }
      });
    }
  });

  // --- Vite middleware setup ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
