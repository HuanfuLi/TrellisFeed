# EchoLearn App Compliance Plan

## 1. Overview
This document outlines the compliance strategy for EchoLearn to ensure successful publication on both the Apple App Store and Google Play Store. As a "Serverless" application that heavily relies on generative AI (LLMs and TTS) and local network features (ZeroTier), EchoLearn must adhere strictly to newly updated AI and privacy guidelines from both platforms.

## 2. Apple App Store Requirements (iOS)

Apple has recently introduced strict privacy requirements regarding AI apps (effective late 2025). EchoLearn must implement the following:

### 2.1 Explicit AI Transparency & Consent
* **Requirement:** Apps must identify third-party AI providers by name and explain data usage. Explicit user consent is required before sending data.
* **Implementation Plan:**
  * **Onboarding Flow:** Incorporate a mandatory "AI Data Usage & Consent" screen during onboarding. 
  * **Transparency:** Clearly state that EchoLearn uses user-provided API keys to communicate directly with third-party providers (e.g., OpenAI, Anthropic) or local networks.
  * **Explicit Consent:** Require users to check a box or tap an "I Agree" button specifically for data transmission to the configured LLM/TTS provider before evaluating any prompts.

### 2.2 API Key Security
* **Requirement:** Sensitive user data must be stored securely.
* **Implementation Plan:** Use iOS Keychain (via React Native / Flutter secure storage libraries) to encrypt and store the user's API keys. Never store them in plain text `UserDefaults`.

### 2.3 Settings & Revocation
* **Requirement:** Users must have clear settings to review and revoke consent.
* **Implementation Plan:** 
  * The `Settings` page must allow users to easily delete their API keys and disconnect from ZeroTier, instantly halting any remote data transmission.
  * Add a "Privacy & Data" section in Settings explaining the local-first nature (SQLite) of the app.

## 3. Google Play Store Requirements (Android)

Google Play enforces strict AI-Generated Content (AIGC) policies to prevent harmful or deceptive content.

### 3.1 Content Moderation and Safeguards
* **Requirement:** Developers are accountable for generative AI outputs and must implement in-app reporting/flagging features.
* **Implementation Plan:**
  * **In-App Reporting:** Even though the user provides their own API key, Google requires a way to "report" or flag offensive content. Add a "Flag output" or "Delete & block context" mechanism on AI response bubbles. Since there is no backend, this action can immediately delete the harmful record from the local SQLite database and exclude it from future prompt context.
  * **System Prompts:** Ensure the system prompts used by EchoLearn include safety constraints (e.g., "Do not generate harmful, illegal, or sexually explicit content").

### 3.2 Clear Definition of App Functionality
* **Requirement:** The app must not facilitate scams, deepfakes, or dishonest behavior.
* **Implementation Plan:** Clearly position EchoLearn in the Play Store listing as a **Personal Knowledge Management & Learning tool**, emphasizing the "spaced repetition" and "study" aspects to avoid being classified as a generic, unrestricted generative AI sandbox.

## 4. General Compliance & Networking (Both Platforms)

### 4.1 ZeroTier / Local Network Usage
* **Risk:** App Reviewers often flag apps that use VPN protocols (libzt) or attempt to scan local networks without clear justification.
* **Implementation Plan:**
  * Prompt for Local Network permissions explicitly, providing a clear explanation: "EchoLearn needs local network access to connect to your locally hosted LLM/TTS services."
  * Only initialize ZeroTier if the user explicitly configures it in Settings. Do not start the service quietly in the background on app launch.

### 4.2 Background Execution (Daily Podcast)
* **Risk:** Background tasks (like generating a podcast 1 hour before sleep) are heavily restricted by both iOS and Android battery management.
* **Implementation Plan:**
  * Use proper background task scheduling APIs (e.g., `BGTaskScheduler` for iOS, `WorkManager` for Android).
  * Design the podcast generation to be resilient to background termination. Handle API timeouts gracefully and use local notifications to inform the user if the generation failed due to OS restrictions.

## 5. Summary Checklist Before Submission
- [ ] Implement explicit consent screen for OpenAI/Claude data transmission (iOS).
- [ ] Add "Flag/Report" button to AI chat UI (Android).
- [ ] Ensure API Keys are encrypted in Keychain / Keystore.
- [ ] Add explicit text in App Store listings clarifying the "Bring Your Own Key" (BYOK) model.
- [ ] Ensure clear explanations for Local Network / ZeroTier permission requests are present in `Info.plist` and Android manifest.
