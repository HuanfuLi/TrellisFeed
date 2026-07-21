try:
    from duckduckgo_search import DDGS
    results = DDGS().text('site:x.com "AI agents"', max_results=30)
    for r in results:
        print(r['href'])
except ImportError:
    print("duckduckgo_search not installed")
