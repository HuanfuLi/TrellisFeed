---
phase: 01-rebrand-research-shell-hardening
plan: 13
subsystem: phase-closeout-and-device-validation
tags: [rebrand, english-default, android, offline-outbox, diagnostics, cleanup]

requires:
  - phase: 01-11
    provides: "Consent-first authenticated enrollment and deployed collector."
  - phase: 01-12
    provides: "Durable offline upload queue, reconciliation, and quarantine."
provides:
  - "QuestionTrace-only participant surfaces and deterministic English fresh-install behavior."
  - "Cross-platform zero-exemption test discovery and repaired load-bearing source contracts."
  - "Physical Android evidence for consent, offline persistence, automatic upload, diagnostics, export, and cleanup."
  - "A timed retry fallback for Android WebView connectivity transitions that emit no online event."
affects: [phase-2, mobile-release-builds, research-operations]

tech-stack:
  added: []
  patterns: [active-surface residue guards, deterministic locale default, periodic outbox safety net, sanitized device evidence]

key-files:
  created:
    - app/scripts/run-tests.mjs
    - .planning/phases/01-rebrand-research-shell-hardening/01-TEST-BASELINE.md
    - .planning/phases/01-rebrand-research-shell-hardening/01-13-SUMMARY.md
  modified:
    - app/src/services/upload-queue.service.ts
    - app/tests/services/upload-queue.service.test.mjs
    - .planning/phases/01-rebrand-research-shell-hardening/01-DEPLOYMENT-SMOKE.md

key-decisions:
  - "A fresh installation always begins in English; only explicit participant selection changes the UI locale."
  - "Native microphone and notification capabilities are outside the research scope and remain removed."
  - "Online and native-resume events remain fast retry signals, with a 15-second local-only empty-queue check as the final Android WebView fallback."
  - "The device checkpoint used an isolated Phase-1-only build because concurrent Phase 2 commits intentionally fail closed without the later content package."
  - "The diagnostics PIN raw value stays only in a git-ignored production-local file; the build receives only its SHA-256 digest."

requirements-completed: [SHELL-01, SHELL-04, LOG-01, RQ-01]

verification:
  automated:
    - "Upload queue focused suite: 24/24 pass."
    - "TypeScript and lint pass after the Android retry fix."
    - "Pure Phase 1 application suite: 860/860 pass before device packaging."
    - "Production build, Capacitor copy, and Android debug assembly pass."
  device:
    - "Fresh English numeric setup and consent-first zero-write gate pass."
    - "Offline behavioral/Q/A persistence, force-stop relaunch, and automatic reconnect drain pass."
    - "PIN diagnostics and recovery export pass with minimal fields only."
    - "Remote receipt and complete local/remote fixture cleanup pass."

commits:
  - "b5e2c6d fix(01-13): remove retired native permissions"
  - "68387d6 fix(01-13): retry uploads when WebView misses online event"
---

# Phase 01 Plan 13 Summary

Phase 1 closes with a clean QuestionTrace research shell, deterministic English onboarding, a genuine cross-platform test runner, and physical Android evidence for the complete consent-to-cloud path. The device run exposed two production-only issues—retired native permission prompts and a missed WebView connectivity transition—and both were fixed with regression coverage before the final smoke was accepted.

The temporary account and every associated cloud/local record were removed after validation. Sensitive deployment values remain outside tracked artifacts.
