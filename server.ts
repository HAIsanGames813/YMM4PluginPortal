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

  // API Route: GitHub Release details
  app.get('/api/ymm4/github-detail/:user/:repo', async (req, res) => {
    const { user, repo } = req.params;
    try {
      const url = `https://manjubox.net/api/ymm4plugins/github/detail/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      let response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return res.json({ success: true, data });
      }

      // If manjubox API fails or returns 404, fallback to direct GitHub API
      console.warn(`Manjubox detail failed (${response.status}) for ${user}/${repo}, falling back to GitHub API...`);
      const ghApiUrl = `https://api.github.com/repos/${user}/${repo}/releases`;
      const ghRes = await fetch(ghApiUrl, {
        headers: { 'User-Agent': 'YMM4-Plugin-Portal' }
      });

      if (ghRes.ok) {
        const releases = await ghRes.json();
        return res.json({
          success: true,
          data: {
            user,
            repo,
            releases: Array.isArray(releases) ? releases : [releases]
          }
        });
      }

      res.status(404).json({
        success: false,
        error: `Releases not found for ${user}/${repo}`
      });
    } catch (err: any) {
      console.error(`Error fetching detail for ${user}/${repo}:`, err);
      res.status(500).json({ success: false, error: err.message });
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
