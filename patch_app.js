import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/fetchExternalPlugins\(basePlugins\)\.then\(\(extPlugins\) => \{[\s\S]*?\}\)\.catch\(\(err\) => \{[\s\S]*?\}\);/, `// External plugins are now baked into plugins-data.json at build time
        // so we don't need to fetch them client-side anymore!`);

fs.writeFileSync('src/App.tsx', content, 'utf8');
