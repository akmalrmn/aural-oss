# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are employers, recruiters, and hiring teams managing open roles, reviewing applicants, and deciding who advances. They work in the authenticated Skilio Hiring workspace at `assessment.skilio.co`.

Candidates are the secondary users. They open a public job application link, choose whether to use their existing Skilio identity or apply manually, provide application evidence, complete required assessment steps, and submit their application to the employer.

## Product Purpose

Skilio Hiring gives employers one workspace to create and publish jobs, manage opening status, monitor applicant volume, review complete applications, and accept, shortlist, or reject candidates.

The product connects hiring decisions to candidate evidence. Applications can include profile information, CVs, portfolio links, skills, supporting evidence, screening answers, and Drawmetrics results. Employers can also use the retained interview workspace to create and manage AI-assisted interviews when a hiring process needs them.

Success means employers can move from opening a role to making an informed applicant decision without losing candidate evidence across disconnected tools, while candidates can reuse trusted Skilio profile data instead of repeatedly rebuilding an application.

## Positioning

Skilio Hiring combines portfolio-backed candidate identity and skill evidence, reusable Drawmetrics, applicant management, and optional AI interviews in one hiring workspace. Its distinguishing mechanism is the connection between a candidate's existing Skilio portfolio record and the evidence an employer reviews for a specific role.

## Operating Context

Employers:

- Create draft job openings, define role details and required skills, then publish a public application link.
- Track opening status, applicant totals, applicant sources, and hiring progress.
- Open a dedicated applicant review page containing the submitted form, CV, skills, evidence, portfolio links, screening answers, and Drawmetrics results.
- Make review, acceptance, shortlist, or rejection decisions from the applicant record.
- Use the Interviews section for the full retained Aural workflow: interview creation, sessions, question management, practice, projects, usage, and results.

Candidates:

- Arrive through a public `/apply/[slug]` job link.
- Can sign in through `portfolio.skilio.co` to reuse verified profile, CV, skills, and evidence, or continue manually.
- Complete the application steps, including ten Drawmetrics drawings and ten phrases when a reusable result is not available.
- Can reuse a valid Drawmetrics set completed within the previous 365 days; at the one-year boundary they must complete it again.
- Submit the application without being required to complete an interview unless the employer separately adds one to the hiring process.

## Capabilities and Constraints

- The authenticated employer product is Skilio Hiring on `assessment.skilio.co`.
- Candidate identity and portfolio profile data are connected through `portfolio.skilio.co`.
- Employer access remains on `assessment.skilio.co`; candidate portfolio authentication must not replace the employer login model.
- Job applications do not require an interview by default.
- All legacy Aural employer functionality must remain available under the top-level Interviews section and its child navigation.
- Drawmetrics is collected in every application mode unless the candidate has a valid set from the previous 365 days.
- A Drawmetrics set consists of exactly ten captured drawings and ten candidate-authored phrases.
- Drawmetrics data is currently stored in the Skilio Hiring backend. It must remain structured for transmission to the external scoring API when that API becomes available.
- Product interface copy is English-only.
- Public application links and authenticated employer routes must work on desktop and mobile web.

## Brand Commitments

- The product name is **Skilio Hiring**.
- Candidate-facing identity uses **Skilio**.
- The Skilio portfolio and Skilio Hiring experience must read as connected parts of one product family.
- Existing Skilio logo assets are binding brand assets:
  - `public/logos/skilio-logo.png`
  - `public/logos/skilio-leaf-square.png`
- Aural is retained as product functionality inside the Interviews module, not as the primary employer-facing brand.
- Interface language should be direct, operational, and specific to the action an employer or candidate is taking.

## Evidence on Hand

- A working employer portal with job, applicant, workspace, and interview routes exists in `src/app/(dashboard)`.
- The public candidate application flow exists at `src/app/apply/[slug]/page.tsx`.
- Skilio SSO and portfolio profile synchronization are implemented in `src/lib/skilio-sso.ts`.
- Employer application review, including CV, evidence, skills, screening answers, and Drawmetrics, exists at `src/app/(dashboard)/jobs/[id]/applicants/[applicationId]/page.tsx`.
- Drawmetrics capture and reuse rules exist in `src/components/drawing` and `src/lib/drawing-assessment.ts`.
- Existing Aural interview documentation and product screenshots remain in `README.md` and `public/images/docs`.
- No approved testimonials, customer logos, pricing claims, hiring outcome benchmarks, or external Drawmetrics scoring claims are present. Future work must not fabricate them.

## Product Principles

1. Keep evidence attached to the decision: employers should never need to reconstruct an applicant's story across separate views or products.
2. Reuse trusted candidate data: profile, CV, skills, evidence, and current assessments should carry forward when consent and validity allow.
3. Keep interviews optional and fully capable: ordinary job applications remain lightweight, while the complete interview system stays available when a hiring process needs deeper assessment.
4. Make hiring status explicit: opening state, applicant progress, and employer decisions must be visible and unambiguous.
5. Preserve one Skilio identity across products: transitions between portfolio, application, and employer review must maintain context and avoid duplicate-account confusion.

## Accessibility & Inclusion

The web product targets WCAG 2.1 AA. Employer and candidate workflows must support keyboard operation, visible focus, semantic controls, sufficient contrast, readable responsive layouts, and reduced-motion preferences.
