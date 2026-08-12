import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

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

async function main() {
  console.log('Fetching YMM4 plugins data at build time...');
  
  let yamlText = '';
  try {
    const res = await fetch('https://manjubox.net/ymm4plugins.yml');
    if (res.ok) {
      yamlText = await res.text();
    }
  } catch (e) {
    console.error('Failed to fetch ymm4plugins.yml:', e);
  }

  let githubList = [];
  try {
    const res = await fetch('https://manjubox.net/api/ymm4plugins/github/list');
    if (res.ok) {
      githubList = await res.json();
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

  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputData = {
    success: true,
    timestamp: new Date().toISOString(),
    plugins: normalizedPlugins
  };

  fs.writeFileSync(path.join(publicDir, 'plugins-data.json'), JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`Successfully generated public/plugins-data.json with ${normalizedPlugins.length} plugins.`);
}

main().catch(err => {
  console.error('Error generating plugins data:', err);
});
