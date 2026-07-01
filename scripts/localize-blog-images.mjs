#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BLOG_DIR = join(ROOT, 'src/content/blog');
const ASSET_ROOT = join(ROOT, 'public/blog-assets');
const PUBLIC_PREFIX = '/blog-assets';

const REMOTE_IMG_PATTERNS = [
	// <img ... src="https://..." ... />
	{ regex: /<img\b([^>]*?)\bsrc=(["'])(https?:\/\/[^"']+)\2([^>]*?)\/?>/gi, kind: 'html' },
	// ![alt](https://...)
	{ regex: /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+"([^"]*)")?\)/g, kind: 'md' },
];

const CONTENT_TYPE_EXT = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/jpg': '.jpg',
	'image/gif': '.gif',
	'image/webp': '.webp',
	'image/svg+xml': '.svg',
	'image/avif': '.avif',
};

async function listMarkdown(dir) {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await listMarkdown(p)));
		else if (/\.(md|mdx)$/i.test(entry.name)) out.push(p);
	}
	return out;
}

function slugFromFile(file) {
	return basename(file).replace(/\.(md|mdx)$/i, '');
}

function guessExtFromUrl(url) {
	const clean = url.split('?')[0].split('#')[0];
	const ext = extname(clean).toLowerCase();
	if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'].includes(ext)) {
		return ext === '.jpeg' ? '.jpg' : ext;
	}
	return '';
}

function hashName(url) {
	return createHash('sha1').update(url).digest('hex').slice(0, 12);
}

async function downloadImage(url, destDir) {
	const headers = {
		'User-Agent':
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
		Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
	};
	if (process.env.GH_COOKIE) headers.Cookie = process.env.GH_COOKIE;
	const res = await fetch(url, { redirect: 'follow', headers });
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	const buf = Buffer.from(await res.arrayBuffer());
	let ext = guessExtFromUrl(url);
	if (!ext) {
		const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
		ext = CONTENT_TYPE_EXT[ct] || '.bin';
	}
	const name = `${hashName(url)}${ext}`;
	const dest = join(destDir, name);
	if (!existsSync(dest)) {
		await mkdir(destDir, { recursive: true });
		await writeFile(dest, buf);
	}
	return name;
}

async function processFile(file) {
	const slug = slugFromFile(file);
	const destDir = join(ASSET_ROOT, slug);
	const publicDir = `${PUBLIC_PREFIX}/${slug}`;
	let src = await readFile(file, 'utf8');
	let changed = 0;
	const failures = [];

	for (const { regex, kind } of REMOTE_IMG_PATTERNS) {
		const matches = [...src.matchAll(regex)];
		for (const m of matches) {
			const url = kind === 'html' ? m[3] : m[2];
			try {
				const filename = await downloadImage(url, destDir);
				const localUrl = `${publicDir}/${filename}`;
				let replacement;
				if (kind === 'html') {
					replacement = `<img${m[1]}src="${localUrl}"${m[4]} />`;
				} else {
					const title = m[3] ? ` "${m[3]}"` : '';
					replacement = `![${m[1]}](${localUrl}${title})`;
				}
				src = src.replace(m[0], replacement);
				changed++;
				console.log(`  ✓ ${url} -> ${localUrl}`);
			} catch (err) {
				failures.push({ url, error: err.message });
				console.warn(`  ✗ ${url} (${err.message})`);
			}
		}
	}

	if (changed > 0) await writeFile(file, src);
	return { file, changed, failures };
}

async function main() {
	if (!existsSync(BLOG_DIR)) {
		console.error(`Blog directory not found: ${BLOG_DIR}`);
		process.exit(1);
	}
	const files = await listMarkdown(BLOG_DIR);
	console.log(`Scanning ${files.length} markdown file(s) under ${BLOG_DIR}`);
	let totalChanged = 0;
	const allFailures = [];
	for (const file of files) {
		const rel = file.replace(ROOT + '/', '');
		console.log(`\n• ${rel}`);
		const { changed, failures } = await processFile(file);
		if (changed === 0 && failures.length === 0) console.log('  (no remote images)');
		totalChanged += changed;
		for (const f of failures) allFailures.push({ file: rel, ...f });
	}
	console.log(`\nDone. Rewrote ${totalChanged} image reference(s).`);
	if (allFailures.length) {
		console.log(`Failures (${allFailures.length}):`);
		for (const f of allFailures) console.log(`  - ${f.file}: ${f.url} — ${f.error}`);
		process.exitCode = 1;
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
