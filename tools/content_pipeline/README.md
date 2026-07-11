# QuestionTrace content pipeline

This package is an operator-only, offline build tool. It does not belong in the participant app and does not search for, discover, or manufacture source URLs.

The locked pilot input is an operator-authored JSON or CSV list for **AI agents & future work** (D-01). Assemble roughly 100–150 candidates (D-04), targeting approximately 70% durable articles/explainers and 30% YouTube videos (D-02), with mostly evergreen material and explicit publication dates where relevant (D-03). Collection is bounded URL-list fetching only (D-09); any AI-assisted source search happens outside this package.

```powershell
node src/cli.ts collect --seeds seeds.json --run-dir runs/pilot --dry-run
node src/cli.ts collect --seeds seeds.json --run-dir runs/pilot --resume
```

`collect` supports `--topic`, `--seeds`, `--run-dir`, `--max-candidates`, `--max-bytes`, `--timeout-ms`, `--resume`, and `--dry-run`. The default pilot topic is capped at 150. An explicitly named later topic may raise the safety cap to at most 800 without changing stage contracts. Dry-run validates and reports source mix/date signals while making zero network or subprocess calls.

Every request and redirect destination is DNS-resolved and checked against the public HTTP(S)-only policy. Credentials in URLs, local/private/link-local/multicast/unspecified destinations, excessive redirects, unexpected MIME, oversized bodies, and timeouts fail closed. Run artifacts stay below the resolved run directory; query values and failed response bodies are not written to logs or failure artifacts.
