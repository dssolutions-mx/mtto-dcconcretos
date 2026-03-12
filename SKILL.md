---
name: dc-concretos-policy
description: "Use this skill to generate policy documents for DC Concretos in their exact visual format. It provides a predefined Node.js docx script that ensures perfect headers, footers, colors (NAVY, GREEN), fonts (Calibri), and structural elements (Sanction Tables, Scenario Tables, Signature Rows) matching the official POL-OPE framework."
license: Proprietary.
---

# DC Concretos Policy Generator

## Overview
This skill provides a standardized `docx` template for generating official DC Concretos policy documents. The template uses `docx-js` to produce perfect styling (fonts, colors, headers, tables) identical to existing policies like POL-OPE-001 and POL-OPE-002.

## How to Use
1. Require the template script in a Node file in your workspace.
2. Build the document array using the helper components (`h1`, `h2`, `p`, `bul`, `num`, `sanctionTable`, `sigRow`, etc).
3. Call `generateDocument`.
