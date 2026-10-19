-- One-off: set a new password (bcrypt, cost 12) for two owner accounts whose password was forgotten.
-- Only the password hash changes; role, company and name are left alone. Change the password after signing in.
UPDATE users
SET password_hash = '$2b$12$ZKxmGEqeLYThpgUrDE20GechZ.REuIlha6A6tE6Ox.dDU7HjTt57S'
WHERE lower(email) IN ('obeidatshadi@jomedco.com', 'shadi@jomedco.com');
