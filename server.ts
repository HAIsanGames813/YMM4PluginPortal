import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import yaml from 'yaml';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

  // API Route: Fetch and parse YMM4 Plugins list
  app.get('/api/ymm4/plugins', async (req, res) => {
    try {
      // Fetch YAML and Github list in parallel with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const [ymlRes, ghListRes] = await Promise.allSettled([
        fetch('https://manjubox.net/ymm4plugins.yml', { signal: controller.signal }),
        fetch('https://manjubox.net/api/ymm4plugins/github/list', { signal: controller.signal })
      ]);

      clearTimeout(timeout);

      let yamlRawData: any = null;
      if (ymlRes.status === 'fulfilled' && ymlRes.value.ok) {
        const text = await ymlRes.value.text();
        try {
          yamlRawData = yaml.parse(text);
        } catch (err) {
          console.error('YAML parse error:', err);
        }
      }

      let githubList: any[] = [];
      if (ghListRes.status === 'fulfilled' && ghListRes.value.ok) {
        try {
          githubList = await ghListRes.value.json();
        } catch (err) {
          console.error('GitHub list JSON parse error:', err);
        }
      }

      // Map github list items for quick lookup
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

      // Process YAML plugin data or fallback
      let rawPluginsList: any[] = [];
      if (Array.isArray(yamlRawData)) {
        rawPluginsList = yamlRawData;
      } else if (yamlRawData && typeof yamlRawData === 'object') {
        if (Array.isArray(yamlRawData.plugins)) {
          rawPluginsList = yamlRawData.plugins;
        } else {
          rawPluginsList = Object.values(yamlRawData);
        }
      }

      // If fetching external fails or empty, log warning
      if (rawPluginsList.length === 0 && githubList.length === 0) {
        console.warn('Could not fetch remote YMM4 plugins.');
      }

      // Normalize plugins data
      const normalizedPlugins = rawPluginsList.map((item: any, idx: number) => {
        const id = item.id || `plugin-${idx}-${Date.now()}`;
        const name = item.name || item.title || item.plugin_name || '無題プラグイン';
        const author = item.author || item.creator || item.user || '不明';
        const type = item.type || item.category || 'その他';
        const description = item.description || item.desc || item.summary || '';
        const url = item.url || item.website || item.homepage || '';
        
        // Ensure links is array of strings or objects
        let links: any[] = [];
        if (Array.isArray(item.links)) {
          links = item.links;
        } else if (typeof item.links === 'object' && item.links !== null) {
          links = Object.entries(item.links).map(([key, val]) => ({ name: key, url: val }));
        } else if (typeof item.links === 'string') {
          links = [item.links];
        }

        // Check both url and links for GitHub repository as requested:
        // "ymlのurlおよびlinksのどちらも確認をしてgithubの有無を判断してください"
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

        // Check if item author/repo matched in githubList if not found
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

        // Extra metadata matched from github list if present
        let extraGhData = null;
        if (ghInfo) {
          const key = `${ghInfo.user.toLowerCase()}/${ghInfo.repo.toLowerCase()}`;
          extraGhData = ghMap.get(key) || null;
        }

        // Check isEnabled in yml (default true unless explicitly false)
        const rawIsEnabled = item.isEnabled ?? item.enabled ?? item.is_enabled;
        const isEnabled = rawIsEnabled === false || rawIsEnabled === 'false' ? false : true;

        // Published date / release date
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

      // Also check if githubList has repositories not in YAML list, add them as plugins
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
            type: ghItem.type || 'GitHub Plugin',
            description: ghItem.description || '',
            url: ghItem.html_url || `https://github.com/${ghItem.user}/${ghItem.repo}`,
            links: [{ name: 'GitHub Repository', url: `https://github.com/${ghItem.user}/${ghItem.repo}` }],
            isGithub: true,
            githubUser: ghItem.user,
            githubRepo: ghItem.repo,
            version: ghItem.latest_tag || ghItem.tag_name || '',
            updatedAt: ghItem.updated_at || '',
            publishedAt: ghItem.created_at || ghItem.published_at || '',
            isEnabled: true,
            license: ghItem.license?.name || ghItem.license || '',
            tags: ['GitHub'],
            extraGhData: ghItem
          });
        }
      }

      res.json({
        success: true,
        count: normalizedPlugins.length,
        plugins: normalizedPlugins,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error in /api/ymm4/plugins:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch plugins',
        plugins: []
      });
    }
  });

  // API Route: Fetch external plugins from GitHub and BOOTH unlisted in manjubox
  app.get('/api/external-plugins', async (req, res) => {
    try {
      // 1. First fetch manjubox plugins list to build deduplication sets
      const ymlRes = await fetch('https://manjubox.net/ymm4plugins.yml').catch(() => null);
      let ymlText = '';
      if (ymlRes && ymlRes.ok) {
        ymlText = await ymlRes.text();
      }
      let existingRaw: any = null;
      try {
        existingRaw = yaml.parse(ymlText);
      } catch (e) {
        // ignore
      }

      const existingGithubKeys = new Set<string>();
      const existingBoothIds = new Set<string>();
      const existingUrls = new Set<string>();

      const registerUrl = (rawUrl: string) => {
        if (!rawUrl || typeof rawUrl !== 'string') return;
        const clean = rawUrl.split('?')[0].split('#')[0].toLowerCase().replace(/\/$/, '');
        existingUrls.add(clean);

        const gh = parseGithubRepo(rawUrl);
        if (gh) {
          existingGithubKeys.add(`${gh.user.toLowerCase()}/${gh.repo.toLowerCase()}`);
        }

        const boothMatch = rawUrl.match(/booth\.pm\/(?:[a-z]{2}\/)?items\/(\d+)/i) || rawUrl.match(/\/items\/(\d+)/i);
        if (boothMatch) {
          existingBoothIds.add(boothMatch[1]);
        }
      };

      let rawPluginsList: any[] = [];
      if (Array.isArray(existingRaw)) rawPluginsList = existingRaw;
      else if (existingRaw && typeof existingRaw === 'object') {
        rawPluginsList = Array.isArray(existingRaw.plugins) ? existingRaw.plugins : Object.values(existingRaw);
      }

      for (const p of rawPluginsList) {
        if (p.url) registerUrl(p.url);
        if (Array.isArray(p.links)) {
          for (const l of p.links) {
            registerUrl(typeof l === 'string' ? l : l.url || l.href);
          }
        }
      }

      // Helper to map GitHub topics to YMM4 Plugin categories
      const mapTopicsToCategory = (topics: string[] = []): string => {
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
      };

      const externalPlugins: any[] = [];

      // 2. Search GitHub strictly by TOPICS (topic:ymm4-plugin, topic:ymm-plugin, topic:ymm4plugin)
      try {
        const ghSearchQueries = [
          'q=topic:ymm4-plugin+OR+topic:ymm-plugin+OR+topic:ymm4plugin+sort:updated-desc'
        ];

        for (const q of ghSearchQueries) {
          const ghRes = await fetch(`https://api.github.com/search/repositories?${q}&per_page=50`, {
            headers: { 'User-Agent': 'YMM4-Plugin-Portal' }
          });
          if (ghRes.ok) {
            const data = await ghRes.json();
            if (data && Array.isArray(data.items)) {
              for (const item of data.items) {
                if (!item.owner || !item.name) continue;

                // Exclude manju-summoner (饅頭遣い)
                const ownerLogin = item.owner.login.toLowerCase();
                if (ownerLogin === 'manju-summoner') continue;

                const key = `${ownerLogin}/${item.name.toLowerCase()}`;
                const htmlUrl = (item.html_url || `https://github.com/${item.owner.login}/${item.name}`).toLowerCase();

                if (existingGithubKeys.has(key) || existingUrls.has(htmlUrl)) continue;

                // Strict topic verification: repository MUST have ymm plugin topics
                const itemTopics: string[] = Array.isArray(item.topics) ? item.topics : [];
                const hasYmmTopic = itemTopics.some((t) =>
                  t.toLowerCase().startsWith('ymm') || t.toLowerCase().includes('ymm4')
                );
                if (!hasYmmTopic) continue;

                existingGithubKeys.add(key);
                existingUrls.add(htmlUrl);

                const pluginType = mapTopicsToCategory(itemTopics);

                externalPlugins.push({
                  id: `ext-gh-${item.id || `${item.owner.login}-${item.name}`}`,
                  name: item.name,
                  author: item.owner.login,
                  type: pluginType,
                  description: item.description || 'GitHubで公開されているYMM4関連プラグインです。',
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
        }
      } catch (err) {
        console.warn('Backend GitHub external search error:', err);
      }

      // 3. Search BOOTH strictly by TAGS (tags[]=YMM4Plugin, tags[]=ymm-plugin, tags[]=ymm4-plugin)
      try {
        const boothUrls = [
          'https://booth.pm/ja/items?tags%5B%5D=YMM4Plugin',
          'https://booth.pm/ja/items?tags%5B%5D=ymm-plugin',
          'https://booth.pm/ja/items?tags%5B%5D=ymm4-plugin'
        ];

        for (const boothUrl of boothUrls) {
          const bRes = await fetch(boothUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            }
          }).catch(() => null);

          if (!bRes || !bRes.ok) continue;

          const html = await bRes.text();

          // Regex parse BOOTH items by card chunks
          const cardChunks = html.split(/<li[^>]*class=["'][^"']*item-card/i).slice(1);
          for (const cardChunk of cardChunks) {
            const cardHtml = cardChunk.substring(0, cardChunk.indexOf('</li>'));

            const idMatch = cardHtml.match(/data-product-id=["'](\d+)["']/i) || cardHtml.match(/\/items\/(\d+)/i);
            if (!idMatch) continue;
            const itemId = idMatch[1];

            if (existingBoothIds.has(itemId)) continue;

            const hrefMatch = cardHtml.match(/href=["']([^"']*(?:booth\.pm)?\/(?:[a-z]{2}\/)?items\/\d+[^"']*)["']/i);
            let fullUrl = hrefMatch ? hrefMatch[1] : `https://booth.pm/ja/items/${itemId}`;
            if (!fullUrl.startsWith('http')) {
              fullUrl = `https://booth.pm${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
            }

            // Extract Shop Name / Store Name (店舗名)
            let author = '';
            const shopDivMatch = cardHtml.match(/class=["'][^"']*(?:item-card__shop-name|shop-name-text|shop-name)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
              || cardHtml.match(/class=["'][^"']*(?:item-card__shop-name-anchor|shop-info)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
            const dataBrandMatch = cardHtml.match(/data-product-brand=["']([^"']+)["']/i);

            if (shopDivMatch) {
              author = shopDivMatch[1].replace(/<[^>]+>/g, '').trim();
            } else if (dataBrandMatch) {
              author = dataBrandMatch[1].trim();
            }

            // Subdomain fallback
            if (!author || author === 'BOOTHショップ') {
              const subMatch = fullUrl.match(/https?:\/\/([a-zA-Z0-9_-]+)\.booth\.pm/i);
              if (subMatch && subMatch[1] !== 'booth' && subMatch[1] !== 'ja' && subMatch[1] !== 'www') {
                author = subMatch[1];
              }
            }
            if (!author) author = 'BOOTHショップ';

            // Exclude manju-summoner / 饅頭遣い
            if (author.toLowerCase().includes('manju-summoner') || author.includes('饅頭遣い')) {
              continue;
            }

            // Extract Title (製品名)
            let title = '';
            const titleAnchor = cardHtml.match(/class=["'][^"']*item-card__title[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|h\d|span|a)>/i);
            const dataNameMatch = cardHtml.match(/data-product-name=["']([^"']+)["']/i);
            if (titleAnchor) {
              title = titleAnchor[1].replace(/<[^>]+>/g, '').trim();
            } else if (dataNameMatch) {
              title = dataNameMatch[1].trim();
            }

            let price = '';
            const priceMatch = cardHtml.match(/data-product-price=["']([^"']+)["']/i)
              || cardHtml.match(/class=["'][^"']*(?:price|item-card__price)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i);
            if (priceMatch) {
              price = priceMatch[1].replace(/<[^>]+>/g, '').trim();
              if (/^\d+$/.test(price)) price = `¥ ${price}`;
            }

            const cleanUrl = fullUrl.split('?')[0].toLowerCase().replace(/\/$/, '');
            if (existingUrls.has(cleanUrl)) continue;

            existingBoothIds.add(itemId);
            existingUrls.add(cleanUrl);

            externalPlugins.push({
              id: `ext-booth-${itemId}`,
              name: title || `BOOTHアイテム #${itemId}`,
              author,
              type: 'Booth自動取得',
              description: `BOOTHで「YMM4Plugin」等のタグで出品されている作品です。${price ? ` (価格: ${price})` : ''}`,
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
        }
      } catch (err) {
        console.warn('Backend BOOTH external search error:', err);
      }

      res.json({
        success: true,
        count: externalPlugins.length,
        plugins: externalPlugins
      });
    } catch (err: any) {
      console.error('Error in /api/external-plugins:', err);
      res.status(500).json({ success: false, error: err.message, plugins: [] });
    }
  });

  // API Route: Get latest YMM4 version from manjubox RSS (primary) with GitHub fallback
  app.get('/api/ymm4/latest-version', async (req, res) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      // 1. Try manjubox RSS first (fast, reliable, no rate limit)
      try {
        const rssRes = await fetch('https://manjubox.net/rss.xml', {
          signal: controller.signal,
          headers: { 'User-Agent': 'YMM4-Plugin-Portal' }
        });
        if (rssRes.ok) {
          const xmlText = await rssRes.text();
          const match = xmlText.match(/ゆっくりMovieMaker\s+(?:v|ver\.?)?\s*([4-9]\.\d+(?:\.\d+)?(?:\.\d+)?)/i);
          if (match && match[1]) {
            let ver = match[1].trim();
            if (!ver.toLowerCase().startsWith('v')) ver = 'v' + ver;
            clearTimeout(timeout);
            return res.json({
              success: true,
              version: ver,
              title: `ゆっくりMovieMaker ${ver}`,
              html_url: 'https://manjubox.net/ymm4/'
            });
          }
          // Generic version match in RSS
          const vMatch = xmlText.match(/v?4\.\d+(?:\.\d+)?(?:\.\d+)?/i);
          if (vMatch) {
            let ver = vMatch[0];
            if (!ver.toLowerCase().startsWith('v')) ver = 'v' + ver;
            clearTimeout(timeout);
            return res.json({
              success: true,
              version: ver,
              title: ver,
              html_url: 'https://manjubox.net/ymm4/'
            });
          }
        }
      } catch (e) {
        console.warn('manjubox RSS fetch error:', e);
      }
      clearTimeout(timeout);

      // 2. Fallback to GitHub tags
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 5000);
      const tagsRes = await fetch('https://api.github.com/repos/manju-summoner/YukkuriMovieMaker4/tags', {
        headers: {
          'User-Agent': 'YMM4-Plugin-Portal',
          'Accept': 'application/vnd.github+json'
        },
        signal: controller2.signal
      }).catch(() => null);
      clearTimeout(timeout2);

      if (tagsRes && tagsRes.ok) {
        const tags = await tagsRes.json();
        if (Array.isArray(tags) && tags.length > 0) {
          const tagName = tags[0].name;
          if (tagName) {
            let ver = tagName.trim();
            if (!ver.toLowerCase().startsWith('v')) ver = 'v' + ver;
            return res.json({
              success: true,
              version: ver,
              title: tagName,
              html_url: `https://github.com/manju-summoner/YukkuriMovieMaker4/releases/tag/${tagName}`
            });
          }
        }
      }

      // 3. Fallback to releases
      const relRes = await fetch('https://api.github.com/repos/manju-summoner/YukkuriMovieMaker4/releases', {
        headers: {
          'User-Agent': 'YMM4-Plugin-Portal',
          'Accept': 'application/vnd.github+json'
        }
      }).catch(() => null);

      if (relRes && relRes.ok) {
        const releases = await relRes.json();
        if (Array.isArray(releases) && releases.length > 0) {
          const latest = releases[0];
          const tagName = latest.tag_name || latest.name;
          if (tagName) {
            let ver = tagName.trim();
            if (!ver.toLowerCase().startsWith('v')) ver = 'v' + ver;
            return res.json({
              success: true,
              version: ver,
              title: latest.name || tagName,
              published_at: latest.published_at,
              html_url: latest.html_url
            });
          }
        }
      }

      res.json({ success: false, version: '不明' });
    } catch (err: any) {
      console.error('Error fetching YMM4 version:', err);
      res.json({ success: false, version: '不明', error: err.message });
    }
  });

  app.get('/api/ymm4/booth-detail', async (req, res) => {
    const urlParam = req.query.url as string;
    if (!urlParam || !urlParam.includes('booth.pm')) {
      return res.status(400).json({ success: false, error: 'Invalid BOOTH URL' });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(urlParam, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
        },
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeout);

      if (!response || !response.ok) {
        return res.status(500).json({ success: false, error: 'Failed to fetch BOOTH page' });
      }

      const html = await response.text();

      // Extract Title and Shop Name / Author (店舗名) using og:title / title tag or DOM elements
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

      // Fallback Shop Name / Author (店舗名)
      if (!author || author === 'BOOTH' || author === 'BOOTHショップ') {
        const shopMatch = html.match(/class=["'][^"']*(?:shop-name|shop-name-text|merchant-name|item-card__author|item-card__shop-name)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|a|p)>/i)
          || html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i)
          || html.match(/data-shop-name=["']([^"']+)["']/i);

        if (shopMatch) {
          author = shopMatch[1].replace(/<[^>]+>/g, '').trim();
        }
      }

      // Subdomain fallback
      if (!author || author === 'BOOTH' || author === 'BOOTHショップ') {
        const subMatch = urlParam.match(/https?:\/\/([a-zA-Z0-9_-]+)\.booth\.pm/i);
        if (subMatch && !['booth', 'ja', 'www'].includes(subMatch[1])) {
          author = subMatch[1];
        }
      }

      // Fallback Title if empty
      if (!title) {
        const titleMatch = html.match(/<h2[^>]*class=["'][^"']*(?:text-headline-1|item-name|title)[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
        if (titleMatch) {
          title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s*-\s*BOOTH$/, '').trim();
        }
      }

      // Extract Price (Find lowest price if multiple variations exist)
      let price = '';
      const priceMatches = html.match(/<(?:div|span|p)[^>]*class=["'][^"']*(?:price|item-price|variation-price)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/gi);
      
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
          price = `¥ ${minPrice}`;
        }
      } 
      
      if (!price) {
        // Fallback to meta tag
        const metaMatch = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i);
        if (metaMatch) {
          const num = parseInt(metaMatch[1].replace(/[^\d]/g, ''), 10);
          if (!isNaN(num)) price = `¥ ${num}`;
        }
      }

      // Extract Description
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

      // Extract Images
      const images: string[] = [];
      const imgRegex = /https:\/\/booth\.pximg\.net\/[a-zA-Z0-9_\-\.\/]+/g;
      let imgMatch;
      while ((imgMatch = imgRegex.exec(html)) !== null) {
        if (!images.includes(imgMatch[0])) {
          images.push(imgMatch[0]);
        }
        if (images.length >= 6) break;
      }

      res.json({
        success: true,
        author: author || 'BOOTHショップ',
        title,
        price,
        description,
        images
      });
    } catch (err: any) {
      console.error('Error in /api/ymm4/booth-detail:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: GitHub Release details
  app.get('/api/ymm4/github-detail/:user/:repo', async (req, res) => {
    const { user, repo } = req.params;
    try {
      const url = `https://manjubox.net/api/ymm4plugins/github/detail/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);

      if (response && response.ok) {
        const data = await response.json().catch(() => null);
        if (data) return res.json({ success: true, data });
      }

      // Seamless fallback to direct GitHub API if manjubox doesn't have it listed
      const ghApiUrl = `https://api.github.com/repos/${user}/${repo}/releases`;
      const ghRes = await fetch(ghApiUrl, {
        headers: { 'User-Agent': 'YMM4-Plugin-Portal' }
      }).catch(() => null);

      if (ghRes && ghRes.ok) {
        const releases = await ghRes.json().catch(() => null);
        return res.json({
          success: true,
          data: {
            user,
            repo,
            releases: Array.isArray(releases) ? releases : (releases ? [releases] : [])
          }
        });
      }

      return res.json({
        success: true,
        data: {
          user,
          repo,
          releases: []
        }
      });
    } catch (err: any) {
      res.json({
        success: true,
        data: {
          user,
          repo,
          releases: []
        }
      });
    }
  });

  // Vite middleware setup
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
