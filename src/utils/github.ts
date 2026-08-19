export function parseGithubRepo(urlStr: string): { user: string; repo: string } | null {
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

export async function fetchGithubReadme(user: string, repo: string): Promise<string | null> {
  if (!user || !repo) return null;

  // 1. Primary: Use Server Backend Cache & Storage Endpoint
  // This automatically saves to data/readmes/${user}__${repo}.md on the server and bypasses rate limits
  try {
    const serverRes = await fetch(`/api/ymm4/readme/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`);
    if (serverRes.ok) {
      const text = await serverRes.text();
      if (text && text.trim().length > 0 && !text.startsWith('# 読み込みエラー') && !text.startsWith('# READMEが見つかりませんでした')) {
        return text;
      }
    }
  } catch (err) {
    console.warn('[README] Backend README endpoint unreachable, falling back to direct fetch:', err);
  }

  // 2. Direct Raw URLs (No rate limits on raw.githubusercontent.com)
  const candidateUrls = [
    `https://raw.githubusercontent.com/${user}/${repo}/HEAD/README.md`,
    `https://raw.githubusercontent.com/${user}/${repo}/HEAD/README.ja.md`,
    `https://raw.githubusercontent.com/${user}/${repo}/HEAD/readme.md`,
    `https://raw.githubusercontent.com/${user}/${repo}/main/README.md`,
    `https://raw.githubusercontent.com/${user}/${repo}/master/README.md`
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0 && !text.includes('404: Not Found')) {
          return text;
        }
      }
    } catch {
      // Continue next candidate
    }
  }

  // 3. Fallback via CORS proxies if direct raw is blocked
  const proxyTemplates = [
    (raw: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(raw)}`,
    (raw: string) => `https://corsproxy.io/?${encodeURIComponent(raw)}`
  ];

  for (const template of proxyTemplates) {
    for (const url of candidateUrls.slice(0, 2)) {
      try {
        const res = await fetch(template(url));
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 0 && !text.includes('404: Not Found')) {
            return text;
          }
        }
      } catch {
        // try next
      }
    }
  }

  // 4. Last resort: GitHub REST API
  try {
    const apiRes = await fetch(`https://api.github.com/repos/${user}/${repo}/readme`, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.download_url) {
        const rawRes = await fetch(data.download_url);
        if (rawRes.ok) {
          const text = await rawRes.text();
          if (text && text.trim().length > 0) return text;
        }
      }
    }
  } catch {
    // API fail
  }

  return null;
}
