"""Validate canonical ownership without network access or third-party packages."""
import argparse
import json
import posixpath
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET


class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.social = []
        self.schemas = []
        self.script = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'canonical' in attrs.get('rel', '').lower().split():
            self.canonicals.append(attrs.get('href', ''))
        if tag == 'meta' and attrs.get('property', '').lower() == 'og:url':
            self.social.append(attrs.get('content', ''))
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.script = ''

    def handle_data(self, data):
        if self.script is not None:
            self.script += data

    def handle_endtag(self, tag):
        if tag == 'script' and self.script is not None:
            self.schemas.append(json.loads(self.script))
            self.script = None


def belongs(url, base):
    """Check both origin and deployment prefix (GitHub Pages shares an origin)."""
    if not base:
        return False
    u, b = urlsplit(url), urlsplit(base)
    prefix = posixpath.normpath(unquote(b.path)).rstrip('/')
    path = posixpath.normpath(unquote(u.path))
    return (u.scheme == b.scheme == 'https' and u.netloc == b.netloc
            and not u.username and not u.password and not u.query and not u.fragment
            and (path == prefix or path.startswith(prefix + '/') or (not prefix and path == '/')))


def document_errors(text, expected, base):
    head = Head()
    try:
        head.feed(text)
    except (ValueError, TypeError) as exc:
        return ['Invalid JSON-LD: ' + str(exc)]
    errors = []
    for label, urls in [('canonical', head.canonicals), ('og:url', head.social)]:
        if len(urls) > 1:
            errors.append('Duplicate ' + label)
        if expected and urls != [expected]:
            errors.append(label + ' must match the verified page URL')
        for url in urls:
            if not expected or not belongs(url, base) or url != expected:
                errors.append(label + ' is unverified, cross-domain, or points to another page')

    def schema_urls(node):
        if isinstance(node, list):
            for item in node:
                schema_urls(item)
        elif isinstance(node, dict):
            types = node.get('@type', [])
            if isinstance(types, str):
                types = [types]
            # Creator/author organization URLs and Person sameAs links are not canonicals.
            if any(t in {'WebSite', 'WebPage', 'WebApplication'} for t in types):
                url = node.get('url')
                if url and (not expected or not belongs(url, base) or url != expected):
                    errors.append('Website/page/application JSON-LD URL is not the verified page URL')
            if '@graph' in node:
                schema_urls(node['@graph'])

    for schema in head.schemas:
        schema_urls(schema)
    return errors


def site_errors(workspace, site):
    errors = []
    directory = workspace / site['root']
    base = site.get('base_url')
    client = site.get('client_metadata')
    for name, expected in site['pages'].items():
        path = directory / name
        if not path.is_file():
            errors.append(name + ': configured source file is missing')
            continue
        errors += [name + ': ' + e for e in document_errors(path.read_text(encoding='utf-8'),
                                                           None if client else expected, base)]
    if client:
        text = (directory / client['source']).read_text(encoding='utf-8')
        match = re.search(r"const SITE_URL = ['\"]([^'\"]+)['\"]", text)
        if not match or match[1] != base:
            errors.append('React metadata base does not match the verified deployment')
        if 'useLocation' not in text or 'rel="canonical"' not in text or 'property="og:url"' not in text:
            errors.append('React route-specific canonical/social metadata is missing')
        for route in client['routes']:
            if repr(route) not in text:
                errors.append('React public route is missing from the metadata allowlist')
    ignored = {'.git', 'node_modules', 'dist', 'target', 'build', 'scripts'}
    for path in directory.rglob('*'):
        if not path.is_file() or ignored.intersection(path.relative_to(directory).parts):
            continue
        name = path.name.lower()
        if name.endswith('.xml') and 'sitemap' in name:
            try:
                tree = ET.fromstring(path.read_text(encoding='utf-8'))
                for node in tree.iter():
                    if node.tag.split('}')[-1] == 'loc' and not belongs((node.text or '').strip(), base):
                        errors.append(str(path.relative_to(directory)) + ': cross-domain sitemap URL')
            except ET.ParseError:
                errors.append(str(path.relative_to(directory)) + ': invalid sitemap XML')
        elif name == 'robots.txt':
            for url in re.findall(r'^\s*Sitemap:\s*(\S+)', path.read_text(), re.I | re.M):
                if not belongs(url, base):
                    errors.append('robots.txt: cross-domain Sitemap directive')
        elif name in {'vercel.json', '_redirects', 'nginx.conf', 'nginx.config'}:
            text = path.read_text(encoding='utf-8')
            destinations = []
            if name == 'vercel.json':
                try:
                    destinations = [r.get('destination', '') for r in json.loads(text).get('redirects', [])]
                except (ValueError, AttributeError):
                    errors.append('vercel.json: invalid redirect configuration')
            elif name == '_redirects':
                destinations = [line.split()[1] for line in text.splitlines()
                                if line.strip() and not line.lstrip().startswith('#') and len(line.split()) >= 2]
            else:
                destinations = re.findall(r'return\s+30[1278]\s+(https?://[^;\s]+)', text)
            for url in destinations:
                if url.startswith(('http://', 'https://')) and not belongs(url, base):
                    errors.append(name + ': external redirect needs deployment ownership review')
        elif name.startswith('.env'):
            # API URLs are separate from site identity; never print environment values.
            for key, url in re.findall(r'^\s*([A-Z_]+)\s*=\s*[\"\']?(https?://[^\s\"\']+)',
                                       path.read_text(), re.M):
                if key in {'SITE_URL', 'PUBLIC_URL', 'NEXT_PUBLIC_SITE_URL', 'VITE_SITE_URL', 'CANONICAL_URL'}:
                    if not belongs(url, base):
                        errors.append(path.name + ': ' + key + ' does not match the verified site')
        elif path.suffix in {'.tsx', '.jsx', '.ts', '.js'} and (not client or not path.as_posix().endswith(client['source'])):
            text = path.read_text(encoding='utf-8')
            # Catch literal Next/React metadata, not ordinary outbound hrefs or creator URLs.
            patterns = [r"canonical\s*:\s*['\"](https?://[^'\"]+)",
                        r"metadataBase\s*:\s*new URL\(['\"](https?://[^'\"]+)"]
            for pattern in patterns:
                for url in re.findall(pattern, text):
                    if not belongs(url, base):
                        errors.append(str(path.relative_to(directory)) + ': cross-domain framework metadata')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=Path(__file__).resolve().parents[1] / 'seo-sites.json')
    parser.add_argument('--require-verified', action='store_true', help='Also fail for pages awaiting production verification')
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8'))
    workspace = args.config.resolve().parent
    failures, pending = [], []
    for site in config['sites']:
        failures += [site['name'] + ': ' + error for error in site_errors(workspace, site)]
        pending += [site['name'] + '/' + name for name, url in site['pages'].items() if not url]
    for error in failures:
        print('ERROR: ' + error)
    for name in pending:
        print('REVIEW: no verified production page for ' + name)
    print(f"Checked {len(config['sites'])} site configurations; {len(failures)} errors; {len(pending)} pages pending verification.")
    return 1 if failures or (args.require_verified and pending) else 0


if __name__ == '__main__':
    sys.exit(main())
