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
        if (text && text.trim().length > 0) {
          return text;
        }
      }
    } catch {
      // Continue next candidate
    }
  }

  // Fallback to GitHub REST API
  try {
    const apiRes = await fetch(`https://api.github.com/repos/${user}/${repo}/readme`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.download_url) {
        const rawRes = await fetch(data.download_url);
        if (rawRes.ok) {
          const text = await rawRes.text();
          if (text) return text;
        }
      }
    }
  } catch {
    // API fail
  }

  return null;
}
