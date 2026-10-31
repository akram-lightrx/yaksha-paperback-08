const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(process.argv[2] || 'bundles');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'versioning.json'), 'utf8'));
assert.deepEqual(manifest.sources.map(x=>x.id).sort(), ['AsuraScans','YakshaComics']);
for (const info of manifest.sources) {
assert.equal(manifest.builtWith.types, '0.8.7');
assert.equal(manifest.builtWith.toolchain, '0.8.7');
assert.equal(info.version, info.id === 'YakshaComics' ? '1.0.1' : '1.0.0');
const icon = fs.readFileSync(path.join(root, info.id, 'includes', info.icon));
assert.equal(icon.subarray(0,8).toString('hex'), '89504e470d0a1a0a', 'Missing PNG icon');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, info.id, 'source.js'), 'utf8'), context);
assert.equal(typeof context.Sources[info.id], 'function');
assert.equal(context.Sources[info.id+'Info'].version, info.version);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(html.includes('paperback://addRepo'), 'Missing installation link');
assert(html.includes(require('../package.json').baseURL), 'Wrong installation URL');
console.log('Bundle verified: 0.8.7 manifest, browser-loadable source, PNG icon and install page.');
