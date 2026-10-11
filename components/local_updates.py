"""Public City of Columbia Water RSS headlines; not an address-specific safety check.

This module uses only Python's standard library. It does not require API keys,
connect to private accounts, or infer whether household drinking water is safe.
"""
from __future__ import annotations

import html
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.request import Request, urlopen

FEEDS = (
    'https://columbiascwater.net/category/alerts/feed/',
    'https://columbiascwater.net/feed/',
)
_CACHE = {'expires_at': 0.0, 'payload': None}


def _plain(text: str) -> str:
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html.unescape(text or ''))).strip()[:240]


def get_water_updates(force=False) -> dict:
    """Fetch recently published official headlines; failure is never an all-clear."""
    if not force and _CACHE['payload'] and time.time() < _CACHE['expires_at']:
        return _CACHE['payload']
    posts, errors, seen = [], [], set()
    for url in FEEDS:
        try:
            req = Request(url, headers={'User-Agent': 'Wattch-Hackathon-Demo/1.0 (public-feed-reader)', 'Accept': 'application/rss+xml, application/xml, text/xml'})
            with urlopen(req, timeout=6) as response:
                data = response.read(1_000_001)
            if len(data) > 1_000_000:
                raise ValueError('Feed too large')
            root = ET.fromstring(data)
            for item in root.findall('.//channel/item')[:12]:
                link = (item.findtext('link') or '').strip()
                if not link.startswith('https://columbiascwater.net/') or link in seen:
                    continue
                title = _plain(item.findtext('title') or '')
                if not title:
                    continue
                pub_date = (item.findtext('pubDate') or '').strip()
                try:
                    published = parsedate_to_datetime(pub_date).strftime('%b %d, %Y')
                except (ValueError, TypeError, IndexError):
                    published = 'Publication date unavailable'
                seen.add(link)
                posts.append({'title': title, 'url': link, 'published': published})
        except Exception as exc:
            errors.append(f'{url}: {type(exc).__name__}')
    payload = {
        'status': 'live' if posts else 'unavailable',
        'location': 'Columbia, South Carolina (regional posts only)',
        'fetched_at': datetime.now(timezone.utc).isoformat(),
        'posts': posts[:7],
        'source': 'City of Columbia Water',
        'notice': 'Published news is not an address-specific boil-water status. Always confirm on the official advisory page.',
    }
    _CACHE['payload'] = payload
    _CACHE['expires_at'] = time.time() + (600 if posts else 60)
    return payload
