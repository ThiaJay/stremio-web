#!/usr/bin/env python3
"""Fail-closed Web asset bundler: no account data, no source maps, no builds from remote at runtime."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil

MAX_SINGLE_BYTES = 80_000_000
MAX_TOTAL_BYTES = 240_000_000
MAX_ITEMS = 3000
ALLOWED = {'.html','.js','.css','.wasm','.woff','.woff2','.ttf','.png','.jpg','.jpeg','.svg','.ico','.webp','.json','.xml','.txt','.gif','.bin','.webmanifest'}
FORBIDDEN = (b'/home/runner/',b'/Users/',b'C:\\Users\\',b'.elfhosted.com/',b'github_pat_',b'Authorization: Bearer ',b'BEGIN PRIVATE KEY')
WEB_SOURCE_PATTERN = re.compile(r'^[a-f0-9]{40}$')


def assess(src, source_sha):
    src = Path(src)
    if not src.is_dir() or not WEB_SOURCE_PATTERN.fullmatch(source_sha):
        raise ValueError('Build path or immutable Git source SHA is missing')
    if not (src / 'index.html').is_file():
        raise ValueError('Enhanced Web entry document is missing')
    html = (src / 'index.html').read_text('utf-8')
    if 'Stremio Enhanced (unofficial)' not in html or 'id="app"' not in html:
        raise ValueError('Refusing a bundle without independently branded Enhanced Web application')
    matches = list(re.finditer(r'[a-f0-9]{40}/scripts/(?:main|worker)\.js', html))
    paths = {m.group() for m in matches}
    for expected in ('main.js', 'worker.js'):
        if not any(x.endswith('/' + expected) for x in paths):
            raise ValueError('Compiled main/worker file reference missing: ' + expected)
    entries, total = [], 0
    for f in sorted(src.rglob('*')):
        if f.is_symlink():
            raise ValueError('Symlink in compiled Web build: ' + str(f))
        if not f.is_file():
            continue
        rel = f.relative_to(src)
        if rel.suffix.lower() == '.map':
            continue
        if rel.suffix.lower() not in ALLOWED or any(part.startswith('.') and part != '.well-known' for part in rel.parts):
            raise ValueError('Unreviewed asset type or hidden path: ' + rel.as_posix())
        content = f.read_bytes()
        if len(content) > MAX_SINGLE_BYTES:
            raise ValueError('Web build asset exceeds size limit')
        total += len(content)
        if total > MAX_TOTAL_BYTES or len(entries) >= MAX_ITEMS:
            raise ValueError('Web build exceeds bounded asset quantity/size')
        if rel.suffix.lower() in {'.js','.css','.html','.json','.xml','.txt','.webmanifest'}:
            if any(x.lower() in content.lower() for x in FORBIDDEN):
                raise ValueError('Private or machine-specific source present in compiled asset')
        entries.append({'path': rel.as_posix(), 'size':len(content),'sha256':hashlib.sha256(content).hexdigest()})
    available = {x['path'] for x in entries}
    if not paths.issubset(available):
        raise ValueError('Referenced compiled scripts not included: ' + str(paths - available))
    return {'schema':1, 'kind':'stremio-enhanced-tv-synthetic-source-preview',
            'sourceRepo':'ThiaJay/stremio-web','exactSourceSha':source_sha,
            'officialClientReplaced':False,'stremioAccountTested':False,
            'realPlaybackTested':False,'tvDeviceTested':False,
            'releaseEligible':False,'assetCount':len(entries),'byteCount':total,
            'files':entries}


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--src',required=True)
    p.add_argument('--dst',required=True)
    p.add_argument('--source-sha',required=True)
    args=p.parse_args()
    manifest=assess(args.src,args.source_sha)
    src=Path(args.src).resolve()
    dst=Path(args.dst).resolve()
    if src == dst or src in dst.parents or dst in src.parents:
        raise ValueError('Source and destination must be separate')
    if dst.exists():
        raise ValueError('Destination must not preexist')
    dst.mkdir(parents=True)
    for f in manifest['files']:
        origin=src/f['path'];target=dst/f['path']
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(origin,target)
        if hashlib.sha256(target.read_bytes()).hexdigest()!=f['sha256']:
            raise ValueError('Staged Web asset changed during copy')
    receipt=dst.parent/'web-source-integrity.json'
    receipt.write_text(json.dumps(manifest,sort_keys=True,indent=2)+'\n',encoding='utf-8')
    print('ENHANCED_TV_WEB_ASSET_VERIFIED',manifest['exactSourceSha'],len(manifest['files']),manifest['byteCount'])

if __name__=='__main__':main()
