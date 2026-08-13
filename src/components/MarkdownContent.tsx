import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownContentProps {
  content: string;
  className?: string;
  baseUrl?: string;
  githubRepoInfo?: { user: string; repo: string };
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className = '',
  baseUrl,
  githubRepoInfo
}) => {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          img: ({ node, src, alt, width, height, ...props }) => {
            if (!src) return null;
            let initialSrc = src;

            // GitHub blob URL -> raw URL conversion
            if (initialSrc.includes('github.com/') && initialSrc.includes('/blob/')) {
              initialSrc = initialSrc.replace('github.com/', 'raw.githubusercontent.com/').replace('/blob/', '/');
            }

            // Relative path conversion
            if (!initialSrc.startsWith('http://') && !initialSrc.startsWith('https://') && !initialSrc.startsWith('data:')) {
              const cleanPath = initialSrc.replace(/^\.\//, '').replace(/^\//, '');
              initialSrc = baseUrl ? `${baseUrl}${cleanPath}` : initialSrc;
            }

            const [imgSrc, setImgSrc] = useState(initialSrc);
            const [hasError, setHasError] = useState(false);

            const handleError = () => {
              if (hasError) return;
              // Fallback strategies for GitHub raw image URLs
              if (githubRepoInfo && imgSrc.includes('githubusercontent.com') && imgSrc.includes('/HEAD/')) {
                setImgSrc(imgSrc.replace('/HEAD/', '/main/'));
              } else if (githubRepoInfo && imgSrc.includes('/main/')) {
                setImgSrc(imgSrc.replace('/main/', '/master/'));
              } else {
                setHasError(true);
              }
            };

            if (hasError) {
              return (
                <span className="inline-block px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-[11px] text-zinc-500 font-mono my-1">
                  🖼️ [画像: {alt || '読込不可'}]
                </span>
              );
            }

            return (
              <img
                {...props}
                src={imgSrc}
                alt={alt || ''}
                onError={handleError}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="max-w-full h-auto rounded-xs border border-zinc-200 dark:border-zinc-700 my-2 shadow-xs block"
              />
            );
          },
          a: ({ node, href, children, ...props }) => {
            if (!href) return null;
            let finalHref = href;
            if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('#') && !href.startsWith('mailto:')) {
              const cleanPath = href.replace(/^\.\//, '').replace(/^\//, '');
              finalHref = githubRepoInfo
                ? `https://github.com/${githubRepoInfo.user}/${githubRepoInfo.repo}/blob/HEAD/${cleanPath}`
                : href;
            }
            return (
              <a
                {...props}
                href={finalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 dark:text-zinc-100 font-bold underline hover:opacity-80 transition-opacity break-all"
              >
                {children}
              </a>
            );
          },
          h1: ({ node, ...props }) => (
            <h1 {...props} className="text-base font-extrabold mt-4 mb-2 border-b border-zinc-300 dark:border-zinc-700 pb-1 text-zinc-900 dark:text-zinc-100" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="text-sm font-extrabold mt-3.5 mb-2 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-0.5" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="text-xs font-bold mt-3 mb-1.5 text-zinc-900 dark:text-zinc-100" />
          ),
          h4: ({ node, ...props }) => (
            <h4 {...props} className="text-xs font-bold mt-2.5 mb-1 text-zinc-800 dark:text-zinc-200" />
          ),
          h5: ({ node, ...props }) => (
            <h5 {...props} className="text-[11px] font-bold mt-2 mb-0.5 text-zinc-800 dark:text-zinc-200" />
          ),
          h6: ({ node, ...props }) => (
            <h6 {...props} className="text-[11px] font-semibold mt-1.5 mb-0.5 text-zinc-700 dark:text-zinc-300" />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="mb-2 last:mb-0 text-zinc-800 dark:text-zinc-200 leading-relaxed break-words text-xs" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc list-inside my-2 space-y-1 pl-2 text-zinc-800 dark:text-zinc-200 text-xs" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal list-inside my-2 space-y-1 pl-2 text-zinc-800 dark:text-zinc-200 text-xs" />
          ),
          li: ({ node, ...props }) => (
            <li {...props} className="leading-relaxed text-zinc-800 dark:text-zinc-200 text-xs my-0.5" />
          ),
          hr: ({ node, ...props }) => (
            <hr {...props} className="my-3 border-t-2 border-zinc-300 dark:border-zinc-700" />
          ),
          code: ({ node, className, children, ...props }: any) => {
            const isInline = !String(children).includes('\n') && !className;
            return isInline ? (
              <code
                {...props}
                className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-[11px] font-mono rounded-xs font-bold"
              >
                {children}
              </code>
            ) : (
              <code
                {...props}
                className="block p-3 my-2 bg-zinc-900 text-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 text-[11px] font-mono overflow-x-auto rounded-xs border border-zinc-700 leading-normal"
              >
                {children}
              </code>
            );
          },
          blockquote: ({ node, ...props }) => (
            <blockquote
              {...props}
              className="border-l-4 border-zinc-400 dark:border-zinc-500 pl-3 my-2 text-zinc-600 dark:text-zinc-400 italic bg-zinc-100/50 dark:bg-zinc-800/50 py-1"
            />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2 border border-zinc-300 dark:border-zinc-700">
              <table {...props} className="min-w-full text-xs font-mono" />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th {...props} className="border border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 p-1.5 font-bold text-left text-zinc-900 dark:text-zinc-100" />
          ),
          td: ({ node, ...props }) => (
            <td {...props} className="border border-zinc-300 dark:border-zinc-700 p-1.5 text-zinc-800 dark:text-zinc-200" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

