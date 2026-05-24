# QR Jewelry Catalog — Claude Implementation Rules

Claude is the implementation assistant for this project.

## Project Authority

ChatGPT Project is the orchestrator and architecture authority.

Claude should implement only the approved task, file, or change requested by ChatGPT.

The repository is the source of truth.

## Project Purpose

Build a lean mobile-first QR jewelry catalog MVP for Facebook Marketplace selling.

The catalog should help the seller organize boxed jewelry items with photos, price, short description, availability status, and eventually QR-ready product links.

## Business Goal

Help the seller present jewelry more professionally and make it easier for buyers to browse related available items.

## MVP Rules

1. Keep the project lean.
2. Work one task at a time.
3. Do not overengineer.
4. Do not add payments.
5. Do not add shipping workflows.
6. Do not add authentication.
7. Do not add a complex backend at the beginning.
8. Prioritize seller simplicity.
9. Prioritize mobile-first design.
10. Prioritize visual elegance.
11. Prioritize QR-driven related-item discovery later.

## Current Tech Direction

Do not assume a framework until ChatGPT approves it.

Initial MVP may begin as a simple static frontend before any backend is added.

Possible early structure:

- index.html
- styles.css
- app.js
- data/items.js
- assets/images/
- docs/

Do not create this structure until explicitly requested.

## Coding Standards

- Use readable beginner-friendly code.
- Use semantic HTML.
- Use clean CSS.
- Use descriptive names.
- Avoid unnecessary dependencies.
- Keep files focused.
- Add comments only where useful.
- Do not create large abstractions early.
- Do not introduce tools or packages without approval.

## Implementation Workflow

Before making changes:

1. Read this file.
2. Read the requested task carefully.
3. Identify affected files.
4. Modify only the approved files.
5. Keep changes small and stable.
6. Briefly report what changed.
7. Do not continue to the next step without instruction.

## Git Rules

Claude should not run git commands unless explicitly instructed.

ChatGPT will guide commits, branches, tags, and GitHub setup.

## Do Not Add Yet

- payment system
- shipping system
- login system
- user accounts
- cloud database
- admin dashboard
- marketplace automation
- AI product generation
- inventory automation
- QR generation package

## Current Phase

PHASE 0 — Project Initialization

Current goal:
Establish the documentation scaffold and version-controlled repo before coding the MVP.
