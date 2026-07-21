import urllib.request, json

url = 'https://www.reddit.com/search.json?q=url:x.com+OR+url:twitter.com+"AI+agents"&sort=new&limit=100'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    links = []
    for child in data['data']['children']:
        post_url = child['data'].get('url', '')
        if 'x.com' in post_url or 'twitter.com' in post_url:
            links.append(post_url)
    print(json.dumps(links, indent=2))
except Exception as e:
    print(e)
