import urllib.request, json

url = 'https://hn.algolia.com/api/v1/search?query=x.com+OR+twitter.com&hitsPerPage=100'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    links = []
    for hit in data.get('hits', []):
        url = hit.get('url', '')
        title = hit.get('title', '')
        if url and ('x.com' in url or 'twitter.com' in url) and ('agent' in title.lower() or 'work' in title.lower() or 'ai' in title.lower()):
            links.append((url, title))
    print(json.dumps(links, indent=2))
except Exception as e:
    print(e)
