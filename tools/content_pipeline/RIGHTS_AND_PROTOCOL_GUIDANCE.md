# Rights and protocol gate for the pilot content pool

This note records general U.S. guidance reviewed for Phase 2. It is not legal advice and does not replace a determination by the controlling institution, principal investigator, IRB, or rights office.

## Release rule

The frozen participant bundle stores and displays complete article text, but for video it stores only the fixed public YouTube URL/ID and a derived reviewed digest. It never stores a transcript, audio, or video copy. Public availability alone does not grant permission to reproduce a complete article. For each article candidate, the rights reviewer must record one of these bases before operator approval:

1. an explicit license that permits this reproduction and display (for example, an applicable Creative Commons license, with every condition satisfied);
2. public-domain status;
3. written permission from the relevant rights holder; or
4. a documented, institution-approved legal determination for this particular use.

If none applies, reject the article candidate for full-text storage. For video, record that playback uses the official embeddable player, the creator has not disabled embedding, the frozen artifact contains only URL/ID plus derived digest, and the digest has been reviewed for faithful, limited paraphrase. Do not infer permission to copy a complete work from a URL, an accessible page, a visible YouTube transcript, or the nonprofit/research character of the project.

## Why the gate is conservative

- [17 U.S.C. §107](https://www.copyright.gov/title17/92chap1.html#107) lists research and scholarship among possible fair-use purposes, but requires a case-specific four-factor analysis. The [U.S. Copyright Office FAQ](https://www.copyright.gov/help/faq/faq-fairuse.html) likewise says there is no fixed permissible word count or percentage. Storing and showing the whole work therefore cannot be approved from “research use” alone.
- [Creative Commons' license guide](https://creativecommons.org/share-your-work/cclicenses/) explains the attribution, ShareAlike, NonCommercial, and NoDerivatives conditions. Reviewers must capture the exact license and attribution, and verify that the publisher or creator actually controls the licensed material.
- [YouTube's Terms of Service](https://www.youtube.com/t/terms) permit viewing and use of the embeddable player, but restrict reproducing/downloading platform content unless the service expressly authorizes it or the relevant permission exists. The official [YouTube transcript help](https://support.google.com/youtube/answer/15930243) documents viewing transcripts for captioned videos; it does not grant a general right to copy and redistribute them.
- The official [YouTube Data API captions.download documentation](https://developers.google.com/youtube/v3/docs/captions/download) requires authorization sufficient to edit the video. Phase 2 therefore does not download captions at all: Gemini reads the public fixed URL through its official video input, and only a reviewed derived digest is retained.

## Human-subjects and institutional control

QuestionTrace studies participant behavior, so the institution's human-research process controls whether the protocol may begin and what content, logging, consent, retention, and access rules apply. [HHS OHRP](https://www.hhs.gov/ohrp/regulations-and-policy/regulations/45-cfr-46/index.html) publishes 45 CFR 46 and explains the Common Rule framework; its [FAQ](https://www.hhs.gov/ohrp/regulations-and-policy/guidance/faq/45-cfr-46/index.html) describes IRB review, informed consent, confidentiality, and institutional assurances. These federal materials are general guidance, not a project-specific determination.

Before freeze, the operator must record:

- institution and PI;
- IRB/protocol identifier or documented institutional determination;
- approved participant-content delivery method (bundled article full text; official video embed/link plus derived digest);
- approved logging, retention, access, and deletion terms;
- rights reviewer identity and rubric version;
- AI-and-work/HCI reviewer identity and rubric version; and
- a per-candidate rights basis, source provenance, reliability review, and explicit operator disposition.

No AI agent, Codex advisory verdict, or automated quality score can supply these institutional decisions or human approvals.
