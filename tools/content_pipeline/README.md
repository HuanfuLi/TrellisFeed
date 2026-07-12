# QuestionTrace content pipeline

This package is an operator-only, offline build tool. It does not belong in the participant app and does not search for, discover, or manufacture source URLs.

The locked pilot input is an operator-authored JSON or CSV list for **AI agents & future work** (D-01). Assemble roughly 100–150 candidates (D-04), targeting approximately 70% durable articles/explainers and 30% YouTube videos (D-02), with mostly evergreen material and explicit publication dates where relevant (D-03). Collection is bounded URL-list fetching only (D-09); any AI-assisted source search happens outside this package.

```powershell
node src/cli.ts collect --seeds seeds.json --run-dir runs/pilot --dry-run
node src/cli.ts collect --seeds seeds.json --run-dir runs/pilot --resume
npm run cli -- normalize --seeds seeds.json --run-dir runs/pilot --resume
npm run cli -- preprocess --run-dir runs/pilot --provider gemini --model gemini-3.1-flash-lite --prompt-version phase-2-video-url-v1 --schema-version preprocessed-post-v1 --max-concurrency 1 --spend-limit 25 --resume
```

`collect` supports `--topic`, `--seeds`, `--run-dir`, `--max-candidates`, `--max-bytes`, `--timeout-ms`, `--resume`, and `--dry-run`. The default pilot topic is capped at 150. An explicitly named later topic may raise the safety cap to at most 800 without changing stage contracts. Dry-run validates and reports source mix/date signals while making zero network or subprocess calls.

Every request and redirect destination is DNS-resolved and checked against the public HTTP(S)-only policy. Credentials in URLs, local/private/link-local/multicast/unspecified destinations, excessive redirects, unexpected MIME, oversized bodies, and timeouts fail closed. Run artifacts stay below the resolved run directory; query values and failed response bodies are not written to logs or failure artifacts.

`normalize` deterministically pairs the sorted operator seed list with the numbered raw collection artifacts. HTML articles pass through the inert Readability extractor. YouTube candidates retain only a canonical public `youtube.com/watch` URL, video ID, and safe metadata; they do not require or store a transcript. The Gemini preprocessing request attaches that exact URL with the official `fileData.fileUri` shape and produces the strict wrapper/digest. URLs containing credential-like query keys are rejected before normalized provenance is persisted.

## Preprocessing credentials

`npm run cli` automatically loads local credentials from `tools/content_pipeline/.env.local` when that file exists. The repository `.gitignore` excludes `.env*`, so this file is never committed. Set exactly one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` for the matching `--provider`. A local OpenAI-compatible endpoint instead uses `QUESTIONTRACE_LOCAL_OPENAI_ENDPOINT` and, when required, `QUESTIONTRACE_LOCAL_OPENAI_KEY`.

Local credential contract:

```dotenv
GEMINI_API_KEY=replace-with-a-newly-rotated-key
```

Environment variables already present in the launching process take precedence over values in `.env.local`. Never put credentials in seeds, run artifacts, source control, command arguments, or chat.

The credential authorizes the live preprocessing request that converts article text or the fixed public YouTube URL into the permanent hook, summaries, concepts, claims, stance, difficulty, and suggested questions. It is not used for URL collection, Codex CLI authentication, human approval, or freeze. The key is read from memory and must never be placed in seeds, run artifacts, source control, command arguments, or chat.

Alternatively, for a one-session PowerShell environment without writing a file or echoing the key:

```powershell
$secure = Read-Host 'OpenAI API key' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
npm run cli -- preprocess --run-dir $runDir --provider openai --model '<top-tier-model-id>' --prompt-version phase-2-v1 --schema-version preprocessed-post-v1 --max-concurrency 1 --spend-limit 25 --resume
Remove-Item Env:OPENAI_API_KEY
```

Use the provider's current documented model identifier and set a deliberate spend limit. The run directory must already contain normalized candidates.

## YouTube URL boundary

The pipeline never downloads or stores a YouTube transcript, audio, or video. It sends one validated public URL per request through Gemini's official video-understanding input, pins `gemini-3.1-flash-lite` (the API rejected 2.5 Flash-Lite as unavailable to new users on 2026-07-12), starts at concurrency 1, and writes one atomic resumable result per candidate. Free-tier preparation may be spread across days; rerun the same command with `--resume`. Runtime Ask uses only the open frozen post's exact URL and falls back to its approved digest if live video understanding fails. The participant cannot supply or substitute a URL.

`.env.local` is operator-only and is never packaged into the mobile app. The current research-prototype runtime uses the existing configured Gemini provider credential in Settings; if it is absent or a non-Gemini provider is selected, video Ask fails over to the frozen digest without sending the URL. A deployment-controlled proxy may replace this provider seam later without changing the frozen content or condition-neutral Ask contract.
