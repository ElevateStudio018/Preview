-- During the preview Elevate Studio is the admin, so that nothing, not even the invitation, reaches the customer's inbox
-- before launch. At launch, and only once Elevate Studio says so, the customer's address is added and invited:
--   insert into private.admin_allowlist (email) values ('<Stenvallers e-postadress>');
insert into private.admin_allowlist (email) values ('elevate.studio018@gmail.com') on conflict do nothing;
