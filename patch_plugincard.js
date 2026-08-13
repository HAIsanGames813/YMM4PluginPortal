import fs from 'fs';
let content = fs.readFileSync('src/components/PluginCard.tsx', 'utf8');

content = content.replace(/const BoothPriceTag[\s\S]*?interface PluginCardProps/m, `const BoothPriceTag: React.FC<{ plugin: YMM4Plugin }> = ({ plugin }) => {
  if (!plugin.price) return null;

  return (
    <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 font-bold ml-auto">
      価格: {plugin.price}
    </span>
  );
};

interface PluginCardProps`);

fs.writeFileSync('src/components/PluginCard.tsx', content, 'utf8');
