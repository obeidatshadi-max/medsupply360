# Backup and restore runbook

Applies to the production database of medsupply360 (Netlify Database, PostgreSQL). Owner of this runbook: the person who administers the Netlify site. Review it after every change to hosting or the schema.

## What must be protected

| Item | Where it lives | Lost if the database is lost? |
|---|---|---|
| Company data: users, ERP imports, tenders, guarantees, payments, sales force, visits, management actions, audit log | Postgres (all tables in `src/db/schema.ts`) | Yes, and it is the only copy of manually entered data (tenders, guarantees, payments, people, visits, actions) |
| ERP-imported data (sales, receipts, stock, invoices) | Postgres, copied from Alpha exports | Recoverable by re-importing the original export files, if the customer keeps them |
| Original Alpha export files | The customer's accountant / shared folder | Not stored by the app. Ask the customer to keep every file they upload |
| Code and migrations | GitHub `obeidatshadi-max/medsupply360` | No |
| Environment variables | Netlify site settings | Yes. Record the list (not the values) below |

Manually entered data cannot be rebuilt from ERP files. That is why the backups below matter.

## Targets

- Recovery point: lose at most 24 hours of manual entries (daily backup), and none caused by an import or migration (backup right before each).
- Recovery time: restore into a working database in under 2 hours.

Change these only with the customer's agreement.

## 1. Check what Netlify already provides (do this first, once)

Unverified at the time of writing. Open the site in Netlify, go to the Database section, and write down in the log at the bottom of this file:

- Whether automatic backups or point-in-time restore exist for this database, how far back they reach, and how to trigger a restore.
- Whether the plan keeps them for the retention you need.

Treat provider backups as a second layer. Do not rely on them alone until a restore from them has been tested.

## 2. Independent backup (works with any Postgres host)

### Tools

Install the PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`), same major version as the server or newer. This machine does not have them yet. Check the server version with `select version();`.

### Connection string

Get it from the Netlify site's Database settings. Keep it in a password manager and in a shell variable for the session only:

```bash
export PGURL='postgres://...'   # never commit it, never paste it into chat or a ticket
```

Do not print Netlify environment variables with JSON or show-values options. Use the masked view.

### Take a backup

```bash
STAMP=$(date +%Y-%m-%d_%H%M)
pg_dump "$PGURL" --format=custom --no-owner --no-privileges --file "medsupply360_$STAMP.dump"
pg_restore --list "medsupply360_$STAMP.dump" | head      # must list tables, not error
ls -l "medsupply360_$STAMP.dump"                          # size must be plausible, not a few KB
```

Custom format is compressed and lets you restore single tables.

### When

- Every day (set a calendar reminder for the owner, or schedule it on a machine that is on).
- Before every ERP import that replaces a stock or unpaid-invoice snapshot. The app keeps no history of a replaced snapshot date, so the dump is the only way back.
- Before merging any pull request that contains a migration, and before the production deploy that applies it.
- Before any manual SQL.

### Where to keep it

- Encrypted, off the machine that took it (for example an encrypted cloud folder or external drive). The dump holds customer financial data and password hashes: treat it as confidential.
- Never in Git, never in the repo folder, never in chat.
- Name files `medsupply360_YYYY-MM-DD_HHMM.dump`.

### Retention

Keep 7 daily, 4 weekly, 6 monthly. Keep the pre-import and pre-migration dumps for 30 days. Delete older files securely.

## 3. Restore

Restoring overwrites data. Decide the scope first, and tell the customer's owner before starting.

1. Stop writes. Ask users to stop, or set the site to maintenance by unpublishing the deploy in Netlify. Take a fresh dump of the current state first, even if it is damaged: `medsupply360_BEFORE-RESTORE_<stamp>.dump`.
2. Choose the dump. Confirm its date and that it passes `pg_restore --list`.
3. Restore into an empty database, not on top of the live one, when possible:
   ```bash
   createdb restore_check                                  # or create a new database in the host
   pg_restore --no-owner --no-privileges --dbname "$TARGET_URL" medsupply360_<stamp>.dump
   ```
4. Run the checks in section 4 against that database.
5. Only then point production at it, or, if the host allows only the existing database, restore into it with `--clean --if-exists` after step 1's fresh dump exists.
6. Redeploy only if the connection string changed.
7. Tell the customer what time the data was restored to, so they can re-enter anything entered after it.

Single table (for example a bad tender edit):

```bash
pg_restore --no-owner --dbname "$TARGET_URL" --table=tenders --data-only --clean medsupply360_<stamp>.dump
```

Check foreign keys before doing this on tables that others reference.

### Bad ERP import

Snapshot imports replace the whole snapshot date. If the wrong file was loaded:

1. Prefer re-importing the correct original file for that type and date.
2. If that is not possible, restore the pre-import dump (section 3) into a scratch database and copy the affected tables back.

## 4. Checks after any restore

Run in `psql`, and compare with the numbers recorded at backup time (write them in the log below):

```sql
select count(*) from companies;
select count(*) from users;
select count(*) from tenders;
select count(*) from sales_lines;
select max(created_at) from audit_logs;
```

Then in the app, signed in as a test owner:

- Sign in works, and the company name is right.
- The data-freshness banner shows the expected "data through" date.
- Dashboard, Tenders, Accounts, and Data history open without errors.
- Migrations are consistent: the database has all migrations listed in `netlify/database/migrations`, and a deploy applies nothing new unexpectedly.

If passwords were reset or users were changed after the backup date, tell the affected users.

## 5. Test the restore (monthly, and once before the first customer goes live)

A backup that was never restored is not a backup.

1. Take a dump as in section 2.
2. Restore it into a throwaway database (a local Postgres, not production).
3. Run the section 4 checks.
4. Record the date, dump size, time taken, and result in the log below.
5. Delete the throwaway database.

## 6. Secrets and settings to record (names only)

Keep the values in a password manager. After a rebuild, these must exist in Netlify:

- `DATABASE_URL` (only if not using the site's own Netlify Database)
- `SESSION_SECRET` (changing it signs everyone out; keep the old one if you want sessions to survive)
- `SIGNUP_INVITE_CODE` (16+ characters, or sign-up stays closed; leave unset to keep it closed)
- `APP_URL`
- `BREVO_API_KEY`, `MAIL_SENDER`, `MAIL_SENDER_NAME` (password-reset email)
- `BOOTSTRAP_OWNER_*`, `BOOTSTRAP_COMPANY_*` (first deploy only; remove after the first login)
- `OPEN_ACCESS` (must stay unset in production)

## 7. If the database is lost or corrupted: first hour

1. Stop writes (section 3, step 1). Do not run more imports or migrations.
2. Take a dump of whatever is left.
3. Find the newest good dump and the provider backup, if any (section 1).
4. Restore into a new database (section 3), run the checks (section 4).
5. Switch production, then tell the customer the restore time and what to re-enter.
6. Write down what happened and what changes prevent it.

## Log

| Date | Action | By | Result |
|---|---|---|---|
| | Checked Netlify provider backups (section 1) | | |
| | First restore test (section 5) | | |
