import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmployerSignupMetadata,
  DEFAULT_HIRING_WORKSPACE_NAME,
  getInviteDisplayName,
  normalizeCompanyName,
  normalizePersonName,
} from "../src/lib/employer-onboarding";

describe("employer onboarding", () => {
  it("normalizes company and owner names for account metadata", () => {
    assert.equal(normalizePersonName("  Alex   Morgan "), "Alex Morgan");
    assert.equal(normalizeCompanyName("  ABC    Company  "), "ABC Company");
  });

  it("builds company-scoped signup metadata with one hiring workspace", () => {
    assert.deepEqual(
      buildEmployerSignupMetadata({
        companyName: "  ABC Company ",
        fullName: " Alex Morgan ",
      }),
      {
        account_type: "employer",
        company_name: "ABC Company",
        full_name: "Alex Morgan",
        initial_workspace_name: DEFAULT_HIRING_WORKSPACE_NAME,
      },
    );
  });

  it("creates a readable fallback name for invited teammates", () => {
    assert.equal(getInviteDisplayName("jane.doe@abc.test"), "Jane Doe");
    assert.equal(getInviteDisplayName("operations_lead@abc.test"), "Operations Lead");
  });
});
