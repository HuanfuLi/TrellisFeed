import urllib.request, urllib.parse, json, re
import time

def search(query, limit=5):
    results = []
    url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        links = re.findall(r'href="([^"]+)"', html)
        for l in links:
            if 'uddg=' in l:
                decoded = urllib.parse.unquote(l.split('uddg=')[1].split('&')[0])
                if decoded.startswith('http') and ('twitter.com' in decoded or 'x.com' in decoded):
                    results.append(decoded)
    except Exception as e:
        print(e)
    return results

q_list = [
    'site:x.com "AI agents" "future of work"',
    'site:x.com "agentic AI" jobs OR skills',
    'site:x.com "AI agents" OR "agentic AI" displacement',
    'site:x.com "AI agents" "entry-level"',
    'site:x.com "AI agents" "labor market"',
    'site:x.com "AI agents" "workplace"',
    'site:x.com "AI agents" management OR HR',
]

all_links = set()
for q in q_list:
    print(f"Searching {q}...")
    links = search(q)
    for l in links:
        all_links.add(l)
    time.sleep(2)

print(json.dumps(list(all_links), indent=2))
