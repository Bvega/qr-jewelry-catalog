# Deferred Remote Supabase Setup

Do not perform these steps until MASTER has accepted M07B-1. This document records the controlled later procedure; it does not authorize remote work.

1. Create a Supabase project in the approved organization and region.
2. Create the owner Auth user through the approved administrative flow.
3. Link the local repository to the intended project with its project reference.
4. Inspect a migration dry run and confirm that only the reviewed migration will apply.
5. Push the reviewed migrations to the linked project.
6. Insert the owner's Auth UUID into `private.catalog_admins` with the `owner` role through an approved administrative SQL session.
7. Review all Supabase Security Advisor findings and resolve any blocking finding.
8. Copy only the project URL and publishable key for a later browser-configuration milestone.
9. Never copy secret or legacy service-role keys into browser code, the repository, examples, fixtures, logs, or documentation.
10. Perform this remote setup only after MASTER acceptance.

Do not seed owner products remotely. Do not use the remote dashboard to make untracked schema changes. Keep the owner UUID and every credential outside Git.
