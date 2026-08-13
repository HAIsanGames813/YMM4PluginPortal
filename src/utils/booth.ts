export interface BoothDetails {
  author?: string;
  title?: string;
  price?: string;
  description?: string;
  images?: string[];
}

export async function fetchBoothDetails(boothUrl: string): Promise<BoothDetails | null> {
  if (!boothUrl || !boothUrl.includes('booth.pm')) return null;

  // 1. Try server endpoint first
  try {
    const apiRes = await fetch(`/api/ymm4/booth-detail?url=${encodeURIComponent(boothUrl)}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.success) {
        return {
          author: data.author,
          title: data.title,
          price: data.price,
          description: data.description,
          images: data.images
        };
      }
    }
  } catch (err) {
    console.warn('Failed to fetch BOOTH details via backend API:', err);
  }

  // 2. Client-side CORS Proxy Fallback
  try {
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(boothUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(boothUrl)}`
    ];

    for (const proxyUrl of proxies) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const html = await res.text();
          if (html && (html.includes('booth.pm') || html.includes('item-description') || html.includes('shop-name'))) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.title || '';
            let author = '';
            let title = '';

            if (ogTitle) {
              let clean = ogTitle.replace(/<[^>]+>/g, '').trim();
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
              const shopEl = doc.querySelector('.item-card__shop-name-text, .shop-name, .item-card__author, [data-shop-name]');
              author = shopEl?.textContent?.trim() || shopEl?.getAttribute('data-shop-name')?.trim() || '';
            }

            if (!author || author === 'BOOTH' || author === 'BOOTHショップ') {
              const subMatch = boothUrl.match(/https?:\/\/([a-zA-Z0-9_-]+)\.booth\.pm/i);
              if (subMatch && !['booth', 'ja', 'www'].includes(subMatch[1])) {
                author = subMatch[1];
              }
            }

            if (!title) {
              const titleEl = doc.querySelector('.text-headline-1, .item-name');
              title = titleEl?.textContent?.replace(/\s*-\s*BOOTH$/, '')?.trim() || '';
            }

            // Extract minimum price among all variations
            let price = '';
            const priceEls = doc.querySelectorAll('.item-price, .price, .variation-price');
            if (priceEls && priceEls.length > 0) {
              let minPrice = Infinity;
              priceEls.forEach(el => {
                const text = el.textContent || '';
                const num = parseInt(text.replace(/[^\d]/g, ''), 10);
                if (!isNaN(num) && num < minPrice) {
                  minPrice = num;
                }
              });
              if (minPrice !== Infinity) {
                price = `¥ ${minPrice}`;
              }
            }
            if (!price) {
              const metaPrice = doc.querySelector('meta[property="product:price:amount"]');
              if (metaPrice) {
                const num = parseInt((metaPrice.getAttribute('content') || '').replace(/[^\d]/g, ''), 10);
                if (!isNaN(num)) price = `¥ ${num}`;
              }
            }

            const descEl = doc.querySelector('.autolink.component-description, .item-description, .js-autolink, [property="og:description"]');
            let description = '';
            if (descEl) {
              if (descEl.hasAttribute('content')) {
                description = descEl.getAttribute('content') || '';
              } else {
                let rawHtml = descEl.innerHTML || '';
                rawHtml = rawHtml
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<\/p>/gi, '\n\n')
                  .replace(/<\/div>/gi, '\n')
                  .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
                  .replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**')
                  .replace(/<[^>]+>/g, '')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .trim();
                description = rawHtml;
              }
            }

            return {
              author: author || 'BOOTHショップ',
              title: title || undefined,
              price: price || undefined,
              description: description || undefined
            };
          }
        }
      } catch {
        // try next proxy
      }
    }
  } catch (e) {
    console.warn('Client BOOTH fetch failed:', e);
  }

  return null;
}
