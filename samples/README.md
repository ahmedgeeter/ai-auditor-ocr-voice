# Meridian Audit Samples & Test Fixtures

Use these sample documents or your own files to evaluate Meridian's multimodal document intelligence and fraud anomaly detection:

### Supported File Types:
- **PDF Documents** (`.pdf`): Commercial Invoices, Employment Contracts, CVs/Resumes, Bank Statements.
- **Image Scans** (`.png`, `.jpg`, `.jpeg`, `.webp`): National ID Cards, Receipts, Passports, Academic Certificates.

### Expected Detection Signals:
1. **Commercial Invoices**:
   - Extraction: Vendor, Tax ID / VAT, Line Items, Subtotal, Tax Percentage, Net Payable, Due Date.
   - Anomaly Check: Mathematical cross-verification (Subtotal + Tax == Total).
2. **Resumes & CVs**:
   - Extraction: Candidate Name, Seniority Level, Contact Information, Technical Skills, Experience History.
   - Anomaly Check: Timeline consistency, employment gaps, conflicting date ranges.
3. **Identity Documents (ID / Passport)**:
   - Extraction: Document Number, Full Legal Name, Nationality, Date of Birth, Expiration Date.
   - Anomaly Check: Document validity expiration, format checksums.
