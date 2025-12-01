<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1vXchpJ36cRXpwzrizwz6I-M1Ks1GAkz2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Project layout

- `src/` hosts the React-based playground UI that backs the demo.
- `src/metal-orm/src/` contains the real MetalORM implementation (AST, builder, dialects, runtime) consumed by the playground.
- Legacy `orm/` and `services/orm/` directories were removed because they were unused duplicates, so future work belongs in `src/metal-orm/src`.
