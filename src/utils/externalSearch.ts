import { YMM4Plugin } from '../types';
import { parseGithubRepo } from './github';

export function mapTopicsToCategory(topics: string[] = []): string {
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

export async function fetchExternalPlugins(existingPlugins: YMM4Plugin[]): Promise<YMM4Plugin[]> {
  // Create sets of existing github user/repo, booth item IDs, and normalized URLs for deduplication
  const existingGithubKeys = new Set<string>();
  const existingBoothItemIds = new Set<string>();
  const existingUrls = new Set<string>();

  const extractBoothItemId = (urlStr: string): string | null => {
    if (!urlStr) return null;
    const match = urlStr.match(/booth\.pm\/(?:[a-z]{2}\/)?items\/(\d+)/i) || urlStr.match(/\/items\/(\d+)/i);
    return match ? match[1] : null;
  };

  const registerExistingUrl = (rawUrl: string) => {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    const cleanUrl = rawUrl.split('?')[0].split('#')[0].toLowerCase().replace(/\/$/, '');
    existingUrls.add(cleanUrl);

    // GitHub match
    const parsedGh = parseGithubRepo(rawUrl);
    if (parsedGh) {
      existingGithubKeys.add(`${parsedGh.user.toLowerCase()}/${parsedGh.repo.toLowerCase()}`);
    }

    // BOOTH item ID match
    const boothId = extractBoothItemId(rawUrl);
    if (boothId) {
      existingBoothItemIds.add(boothId);
    }
  };

  for (const p of existingPlugins) {
    if (p.githubUser && p.githubRepo) {
      existingGithubKeys.add(`${p.githubUser.toLowerCase()}/${p.githubRepo.toLowerCase()}`);
    }
    if (p.url) {
      registerExistingUrl(p.url);
    }
    for (const l of p.links || []) {
      if (l.url) registerExistingUrl(l.url);
    }
  }

  // 1. Try server backend API /api/external-plugins
  try {
    const apiRes = await fetch('./api/external-plugins');
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.success && Array.isArray(data.plugins) && data.plugins.length > 0) {
        const filteredFromApi: YMM4Plugin[] = [];
        for (const item of data.plugins) {
          if (item.author?.toLowerCase().includes('manju-summoner') || item.githubUser?.toLowerCase() === 'manju-summoner') {
            continue;
          }

          const cleanUrl = (item.url || '').split('?')[0].toLowerCase().replace(/\/$/, '');
          const boothId = extractBoothItemId(cleanUrl);
          const ghKey = item.githubUser && item.githubRepo ? `${item.githubUser.toLowerCase()}/${item.githubRepo.toLowerCase()}` : null;

          const isDuplicate = existingUrls.has(cleanUrl) ||
            (boothId ? existingBoothItemIds.has(boothId) : false) ||
            (ghKey ? existingGithubKeys.has(ghKey) : false);

          if (!isDuplicate) {
            existingUrls.add(cleanUrl);
            if (boothId) existingBoothItemIds.add(boothId);
            if (ghKey) existingGithubKeys.add(ghKey);
            filteredFromApi.push(item);
          }
        }
        if (filteredFromApi.length > 0) {
          return filteredFromApi;
        }
      }
    }
  } catch (e) {
    console.warn('Backend /api/external-plugins failed, trying client-side fallback...', e);
  }

  // 2. Client-side Fallback
  const externalPlugins: YMM4Plugin[] = [];

  // GitHub Search API - STRICTLY topic:ymm4-plugin ONLY (Never search title/description)
  try {
    const ghSearchQueries = [
      'q=topic:ymm4-plugin'
    ];

    for (const q of ghSearchQueries) {
      try {
        const res = await fetch(`https://api.github.com/search/repositories?${q}&per_page=50`, {
          headers: { 'Accept': 'application/vnd.github+json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.items)) {
            for (const item of data.items) {
              if (!item.owner || !item.name) continue;

              const ownerLogin = item.owner.login.toLowerCase();
              if (ownerLogin === 'manju-summoner') continue;

              // STRICT REQUIREMENT: Topic MUST contain 'ymm4-plugin' (never match by name/description)
              const itemTopics: string[] = Array.isArray(item.topics) ? item.topics : [];
              const hasYmm4PluginTopic = itemTopics.some((t) => t.toLowerCase() === 'ymm4-plugin');
              if (!hasYmm4PluginTopic) continue;

              const key = `${ownerLogin}/${item.name.toLowerCase()}`;
              const htmlUrl = (item.html_url || `https://github.com/${item.owner.login}/${item.name}`).toLowerCase();

              if (existingGithubKeys.has(key) || existingUrls.has(htmlUrl)) continue;

              existingGithubKeys.add(key);
              existingUrls.add(htmlUrl);

              const pluginType = mapTopicsToCategory(itemTopics);

              externalPlugins.push({
                id: `ext-gh-${item.id || item.node_id || `${item.owner.login}-${item.name}`}`,
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
        // ignore single query failure
      }
    }
  } catch (err) {
    console.warn('Failed to fetch GitHub search API for external plugins:', err);
  }

  // BOOTH Search Fallback (by TAGS & Search)
  try {
    const fetchBoothHtml = async (searchUrl: string) => {
      const proxies = [
        `https://corsproxy.org/?${encodeURIComponent(searchUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(searchUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(searchUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(searchUrl)}`
      ];
      for (const proxy of proxies) {
        try {
          const res = await fetch(proxy);
          if (res.ok) {
            const text = await res.text();
            if (text && (text.includes('booth.pm') || text.includes('item-card'))) return text;
          }
        } catch (e) {
          // ignore
        }
      }
      return null;
    };

    const boothUrlsToSearch = [
      'https://booth.pm/ja/items?tags%5B%5D=YMM4Plugin',
      'https://booth.pm/ja/items?tags%5B%5D=ymm4-plugin'
    ];

    for (const boothUrl of boothUrlsToSearch) {
      const boothHtml = await fetchBoothHtml(boothUrl);
      if (!boothHtml) continue;

      const parser = new DOMParser();
      const doc = parser.parseFromString(boothHtml, 'text/html');

      const itemCards = doc.querySelectorAll('.item-card, li.l-card, .js-item-card, [data-product-id]');

      itemCards.forEach((card, idx) => {
        const linkEl = card.querySelector('a[href*="/items/"]') as HTMLAnchorElement | null;
        let href = linkEl?.getAttribute('href') || '';
        if (href && !href.startsWith('http')) {
          href = `https://booth.pm${href.startsWith('/') ? '' : '/'}${href}`;
        }

        const dataBrand = card.getAttribute('data-product-brand');
        const dataName = card.getAttribute('data-product-name');
        const titleEl = card.querySelector('.item-card__title, .item-card__name, .title');
        const shopEl = card.querySelector('.item-card__shop-name-text, .item-card__shop-name, .item-card__author, .shop-name');

        let author = shopEl?.textContent?.trim() || dataBrand?.trim() || '';

        if (!author || author === 'BOOTH' || author === 'BOOTHショップ') {
          const subMatch = href.match(/https?:\/\/([a-zA-Z0-9_-]+)\.booth\.pm/i);
          if (subMatch && !['booth', 'ja', 'www'].includes(subMatch[1])) {
            author = subMatch[1];
          }
        }
        if (!author) author = 'BOOTHショップ';

        if (author.toLowerCase().includes('manju-summoner') || author.includes('饅頭遣い')) {
          return;
        }

        const name = titleEl?.textContent?.trim() || dataName?.trim();
        const priceAttr = card.getAttribute('data-product-price');
        const priceEl = card.querySelector('.item-card__price, .price, .item-price');
        let rawPrice: string | undefined = undefined;

        if (priceAttr !== undefined && priceAttr !== null && priceAttr !== '') {
          const num = parseInt(priceAttr.replace(/[^\d]/g, ''), 10);
          if (!isNaN(num)) rawPrice = num === 0 ? '無料' : `¥ ${num.toLocaleString()}`;
        }
        if (!rawPrice && priceEl && priceEl.textContent) {
          const textPrice = priceEl.textContent.trim();
          const num = parseInt(textPrice.replace(/[^\d]/g, ''), 10);
          if (!isNaN(num)) rawPrice = num === 0 ? '無料' : `¥ ${num.toLocaleString()}`;
        }

        const cleanHref = href.split('?')[0].toLowerCase().replace(/\/$/, '');
        const boothId = extractBoothItemId(cleanHref);
        const isAlreadyListed = existingUrls.has(cleanHref) || (boothId ? existingBoothItemIds.has(boothId) : false);

        if (name && cleanHref && !isAlreadyListed) {
          existingUrls.add(cleanHref);
          if (boothId) existingBoothItemIds.add(boothId);
          externalPlugins.push({
            id: `ext-booth-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: name,
            author: author,
            type: 'Booth自動取得',
            description: `BOOTHで出品されているYMM4関連作品です。${rawPrice ? ` (価格: ${rawPrice})` : ''}`,
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
    console.warn('Failed to fetch BOOTH search for external plugins:', err);
  }

  return externalPlugins;
}

