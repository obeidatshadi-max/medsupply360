/**
 * Entry point bundled into demo/index.html (scripts/build-demo.mjs): the promotional demo's account views use
 * the same calculation code as the app, so the two can never disagree.
 */
export { PERIOD_DAYS, VIEWS, privateInsights, segmentComparison, summarizeAccountRows, tenderBoard, viewRows, viewSummary } from "./accounts";
export { demoLedger, demoPortfolio } from "./ledger";
export { nextStep } from "@/core/portfolio";
export { GLOSSARY, PAGE_TERMS } from "@/core/glossary";
export { LEVEL_LABEL } from "@/core/opportunities";
export { SADAF_PROFILE, customerProfileStore, demoActionKey, normalizeCustomerProfile, profileDraftFromText } from "./customer-profiles";
export { demoProductReorders, demoReadiness, checkDemoImport, SNAPSHOT_SAMPLE, SNAPSHOT_BAD_SAMPLE } from "./prediction-demo";
export { SPECS as IMPORT_SPECS } from "@/core/import/specs";
export { createCustomerPresentation } from "./customer-presentation";
export { tenderCsvRows, tenderDetailHtml, tenderScreenHtml } from "./tender-screen";