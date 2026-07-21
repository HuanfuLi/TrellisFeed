import urllib.request, urllib.parse, re, json
url = 'https://lite.duckduckgo.com/lite/'
data = urllib.parse.urlencode({'q': 'site:x.com "AI agents" "future of work" OR jobs'}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    links = re.findall(r'href="([^"]+)"', html)
    urls = []
    for l in links:
        if 'twitter.com' in l or 'x.com' in l:
            urls.append(l)
    print(json.dumps(urls, indent=2))
except Exception as e:
    print("Error:", e)
