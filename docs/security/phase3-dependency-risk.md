# Phase 3 — Dependency Risk Assessment

**Assessment target:** maintenance-dashboard  
**Date:** 2025-03-13  
**Input:** Phase 1 Inventory

---

## Dependency Risk Assessment

### Audit Summary
- **Total packages analyzed:** 12,725 (package-lock.json)
- **Packages with known vulnerabilities:** 8 (Critical: 0, High: 4, Moderate: 2, Low: 2)
- **Lockfile present:** Yes (package-lock.json committed)
- **Version pinning strategy:** Range (`^`) for most deps; some exact (e.g., Radix); `"latest"` for @hookform/resolvers, @radix-ui/react-avatar, date-fns, react-day-picker, react-hook-form, zod

---

### Critical & High Findings

| Package | Installed Version | Latest/Fix Version | Severity | CVE/Advisory | Fix Available |
|---------|-------------------|---------------------|----------|--------------|---------------|
| next | 16.0.10 | 16.1.6 | High | GHSA-9g9p-9gw9-jx7f, GHSA-h25m-26qc-wcjf, GHSA-5f7q-jpqc-wp7h | Yes (`npm audit fix --force`) |
| xlsx | ^0.18.5 | None | High | GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9 | No fix available |
| glob | 10.2.0–10.4.5 | TBD | High | GHSA-5j98-mcp5-4vw2 | Yes (`npm audit fix`) |
| minimatch | various | TBD | High | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 | Yes (`npm audit fix`) |
| @eslint/plugin-kit | <0.3.4 | 0.3.4+ | Low | GHSA-xffm-g5w8-qvg7 | Yes |
| brace-expansion | 1.0.0–2.0.1 | TBD | Low | GHSA-v6h2-p8h4-qcjw | Yes |
| ajv | <6.14.0 | 6.14.0+ | Moderate | GHSA-2g4f-4pwh-qvx6 | Yes |
| js-yaml | 4.0.0–4.1.0 | 4.1.1+ | Moderate | GHSA-mh29-5h37-fv8m | Yes |

---

**[next]** — GHSA-9g9p-9gw9-jx7f, GHSA-h25m-26qc-wcjf, GHSA-5f7q-jpqc-wp7h
- Installed version: 16.0.10
- Severity: High
- Description: (1) Image Optimizer DoS via remotePatterns; (2) HTTP request deserialization DoS in React Server Components; (3) Unbounded memory consumption via PPR resume endpoint.
- Impact: DoS (denial of service) against the application; memory exhaustion.
- Fix: Upgrade to next@16.1.6 — run: `npm install next@16.1.6`

**[xlsx]** — GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9
- Installed version: ^0.18.5 (community package; SheetJS)
- Severity: High
- Description: Prototype pollution and ReDoS in SheetJS/xlsx.
- Impact: Prototype pollution could lead to unexpected behavior or injection; ReDoS can cause DoS.
- Fix: **No fix available** from upstream. Consider migrating to `exceljs` (already in project) or `sheetjs-ce` (community edition with fixes) for Excel parsing. Restrict xlsx usage to trusted inputs only; avoid parsing user-uploaded files without validation.

**[glob]** — GHSA-5j98-mcp5-4vw2
- Severity: High
- Description: Command injection via -c/--cmd when matches are executed with shell:true.
- Impact: If glob CLI is invoked with user-controlled input, command injection is possible.
- Fix: `npm audit fix`; ensure glob is not used with user input in CLI mode.

**[minimatch]** — Multiple ReDoS advisories
- Severity: High
- Description: ReDoS via various pattern constructs.
- Impact: DoS when matching untrusted patterns.
- Fix: `npm audit fix`; update transitive dependencies.

---

### Moderate & Low Findings

**[ajv]** — ReDoS when using $data option
- Fix: `npm audit fix`

**[js-yaml]** — Prototype pollution in merge (<<)
- Fix: `npm audit fix`; avoid passing untrusted YAML to load/parse.

**[@eslint/plugin-kit]**, **[brace-expansion]** — ReDoS
- Fix: `npm audit fix`

---

### Supply-Chain Hygiene Findings

| Area | Status | Risk | Recommendation |
|------|--------|------|----------------|
| Lockfile committed | Yes | Low | Keep package-lock.json in repo |
| Version pinning | Range (^) + some "latest" | Medium | Replace "latest" with pinned versions |
| Packages with postinstall | napi-postinstall (from baseline-browser-mapping) | Low | Standard native addon helper; review if suspicious |
| Deprecated packages | None detected | — | — |
| @supabase/auth-helpers-* | Not used | — | Good; using @supabase/ssr |

---

### Outdated Packages (No Known CVE, but Should Upgrade)

| Package | Installed | Latest | Major Behind | Notes |
|---------|-----------|--------|--------------|-------|
| @supabase/supabase-js | 2.49.4 | 2.99.1 | No | Significant version gap; may include auth/security fixes |
| @supabase/ssr | 0.6.1 | 0.9.0 | No | SSR/auth improvements |
| eslint | 9.27.0 | 10.0.3 | Yes | Major upgrade; test before applying |
| tailwindcss | 3.4.17 | 4.2.1 | Yes | Major; breaking changes likely |
| zustand | 4.5.7 | 5.0.11 | Yes | Major; API changes |
| zod | 4.1.13 | 4.3.6 | No | Patch/minor; low risk |
| react, react-dom | 19.2.1 | 19.2.4 | No | Patch updates |

---

### Recommendations

**Immediate:**
- Run `npm audit fix` to address fixable issues (glob, minimatch, ajv, js-yaml, @eslint/plugin-kit, brace-expansion)
- Upgrade Next.js to 16.1.6: `npm install next@16.1.6` (may require `--legacy-peer-deps` if conflicts)

**Short-term:**
- Replace or restrict **xlsx**: migrate Excel handling to `exceljs` where possible; if xlsx must stay, use only for trusted/internal files
- Replace `"latest"` with pinned versions in package.json
- Upgrade @supabase/supabase-js and @supabase/ssr for security and compatibility

**Ongoing:**
- Add `npm audit` to CI (fail on high/critical)
- Consider Dependabot or Renovate for automated PRs
- For ASVS L3: generate and maintain SBOM (e.g., cyclonedx)
