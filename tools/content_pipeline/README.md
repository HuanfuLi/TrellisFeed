# QuestionTrace content pipeline

This package is an operator-only, offline build tool. It does not belong in the participant app and does not search for, discover, or manufacture source URLs.

The locked pilot input is an operator-authored JSON or CSV list for **AI agents & future work** (D-01). Assemble roughly 100–150 candidates (D-04), targeting approximately 70% durable articles/explainers and 30% YouTube videos (D-02), with mostly evergreen material and explicit publication dates where relevant (D-03). Collection is bounded URL-list fetching only (D-09); any AI-assisted source search happens outside this package.

```powershell
node src/cli.ts collect --seeds seeds.json --run-dir runs/pilot --dry-run
node src/cli.ts collect --seeds seeds.json --run-dir runs/pilot --resume
```

`collect` supports `--topic`, `--seeds`, `--run-dir`, `--max-candidates`, `--max-bytes`, `--timeout-ms`, `--resume`, and `--dry-run`. The default pilot topic is capped at 150. An explicitly named later topic may raise the safety cap to at most 800 without changing stage contracts. Dry-run validates and reports source mix/date signals while making zero network or subprocess calls.

Every request and redirect destination is DNS-resolved and checked against the public HTTP(S)-only policy. Credentials in URLs, local/private/link-local/multicast/unspecified destinations, excessive redirects, unexpected MIME, oversized bodies, and timeouts fail closed. Run artifacts stay below the resolved run directory; query values and failed response bodies are not written to logs or failure artifacts.

## Preprocessing credentials

The CLI reads provider credentials from the current process environment; it does not load a repository `.env` file. Set exactly one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` for the matching `--provider`. A local OpenAI-compatible endpoint instead uses `QUESTIONTRACE_LOCAL_OPENAI_ENDPOINT` and, when required, `QUESTIONTRACE_LOCAL_OPENAI_KEY`.

The credential authorizes only the live preprocessing request that converts normalized source text into the permanent hook, summaries, concepts, claims, stance, difficulty, and suggested questions. It is not used for URL collection, Codex CLI authentication, human approval, or freeze. The key is read from memory and must never be placed in seeds, run artifacts, source control, command arguments, or chat.

For a one-session PowerShell environment without echoing the key:

```powershell
$secure = Read-Host 'OpenAI API key' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
npm run cli -- preprocess --run-dir $runDir --provider openai --model '<top-tier-model-id>' --prompt-version phase-2-v1 --schema-version preprocessed-post-v1 --max-concurrency 1 --spend-limit 25 --resume
Remove-Item Env:OPENAI_API_KEY
```

Use the provider's current documented model identifier and set a deliberate spend limit. The run directory must already contain normalized candidates.

## YouTube transcript boundary

The pipeline accepts only an explicitly configured transcript adapter or an operator transcript file with a documented rights basis. YouTube's public **Show transcript** feature permits viewing caption text, but the official Data API caption-download method requires authorization to edit the video. Do not use unofficial endpoints, access-control bypasses, or implicit downloader binaries. A visible transcript does not by itself authorize bundling and redisplaying the complete transcript; unresolved candidates stay resumable and are rejected at the rights gate.
