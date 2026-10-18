# Customer-specific Sadaf360 presentations

The Sadaf360 site is the customer-tailored demonstration of MedSupply360. The original Sadaf profile remains a preset with its historical 2022 facts, organization and supplier context. The app and demo share the account, reorder and CSV validation calculation code.

## Before a customer visit

1. Open the demo and choose **Change company** (also available under Company profile in Basic and Advanced).
2. Choose **New customer**, or upload a PDF/text file/profile JSON. Pasted profile text and manual entry are also supported.
3. Review the extracted draft: company name, location, established date, staffing/date, description, customer groups, ERP, suppliers and notes. Extraction is a convenience and may miss fields. It is not an AI assessment of the company.
4. Choose **Save as new customer**. The workspace identity, profile facts, ERP wording and supplier context change together. For an existing saved customer, use Save changes only when intentionally editing that customer's context.
5. Select saved profiles to switch between visits. Export the profile JSON to transfer it to another computer or keep a backup.

Profiles and demonstration actions are stored in the presenter's browser, not published to the shared website. If browser storage is unavailable, the demo still works for the session; export the profile before closing. Each customer has a separate action history. A new profile uses generic fictional products and sample records, so Sadaf's verified product examples are not attributed to a different company. Switching back to the Sadaf preset restores its original context.

The profile does not provide revenue, costs, actual customer accounts, inventory or predictions of actual company performance. Financial and operational figures remain explicitly synthetic, with a fixed sample snapshot and JOD illustration basis. Supplier names supplied in a profile do not establish current distribution rights or technical compatibility.

## Feature parity

- Basic and Advanced provide searchable sample accounts and Tender/Private views. Filtered account totals remain based on the shared account calculations.
- Management actions demonstrates customer/product repeat ordering with the working app's median-cycle model, including a recent purchase of one product that does not clear an overdue different product. Minimum history and exclusions are shown. These are estimates, not trained AI probabilities.
- Tenders (Advanced) shows the same made-up tenders, guarantees and invoices as the app's Sample tenders page, with the owner's overview, a details drawer per tender, the ten stages and who can do what. Every figure comes from the app's tender rules. The Sadaf preset uses the real Jordanian authority codes; any other profile sees neutral "Authority A–E" names and tender and contract numbers.
- Sales, gross profit and cash figures name their period (Jan-Sep 2026), as on the app's sample screens.
- Data & update routine includes an eight-source readiness scenario: missing inputs, a partial sales load and an unsuccessful snapshot replacement shown separately from the last successful sample load. It is a teaching scenario, not actual import history.
- The ERP screen includes current MedSupply360 CSV format checks using the actual parser and source-column mapping, including ambiguity rejection. Complete and rejected snapshot examples demonstrate preservation of the retained sample quantity. Real uploaded CSVs are checked locally; they do not replace sample dashboard values. Database references and accountant totals still need validation in the working app.

PDF/text/JSON files are read locally. PDF extraction uses the bundled [Mozilla PDF.js](https://mozilla.github.io/pdf.js/) reader, with an 8 MB / 40-page limit. Scanned PDFs need pasted OCR text or manual entry. The original PDF bytes are not stored or uploaded. Exported JSON contains the reviewed profile fields.

## Build and publish

`npm run demo:build` rebuilds the inline code from `src/demo/demo-entry.ts`, and copies the local PDF.js reader/worker/fonts into ignored `demo/assets/pdfjs/`. Rebuild before publishing: the PDF assets must accompany `index.html`. Dependencies and the lockfile are versioned, while these generated assets are recreated from the installed package.

Demo release time is in `demo/demo-status.json`. Main-app release time remains in `src/lib/dashboard-status.json`; a demo-only release does not change the main app's version label. Both are distinct from actual data freshness.

The demo's Netlify site is `sadaf-360-demo`, ID `5bf23be4-0c94-481c-b31d-1a44a8f5eb22`. It is a separate static deployment. Publish a staging copy of the complete `demo/` directory from outside the main app configuration, using the explicit demo site ID, so the main app's Next.js adapter and database deployment settings cannot be applied to this static site.
