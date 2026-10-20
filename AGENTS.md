<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Customer-tailored demonstration

`demo/` is a reusable presentation tailored to the company profile for each customer visit. Preserve the original Sadaf profile as a preset and use the profile switcher for other customers. Supplied company facts and suppliers are context; operational records and financial figures remain clearly synthetic. Keep actions isolated by customer and support profile export for another device.

**Naming:** "medsupply360" is the real app (this repo's Next.js app); "sadaf360" is the promotional demo (`demo/`, synthetic data only, deployed as the static site `sadaf-360-demo`).

**The two are mirrors, in both directions.** Any change the owner asks for in sadaf360 (the demo) is implemented directly in the medsupply360 app in the same piece of work, and vice versa. The demo shows made-up data; the app shows real data; the features, screens, menu, labels and behaviour are identical. At the start of any work, diff the demo's routes, buttons and controls against the app (and the app against the demo) and report gaps before building.

**Every change to the app is mirrored in the demo in the same piece of work**: features, screens, sidebar order and wording, labels, and sample numbers. The demo is the first promotional exposure of the product and must never fall behind. Finish with `npm run demo:build`, the tests, and a look in the browser; ship both in the same PR.

When extending a live workflow that is demonstrated here, reuse its calculation/validation core and update the corresponding demo experience. Do not carry a previous customer's supplier or product claims into a new profile. See `docs/CUSTOMER_DEMO.md` for build, PDF assets and the separate static-site deployment.
