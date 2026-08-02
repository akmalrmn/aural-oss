import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { getInviteDisplayName } from "@/lib/employer-onboarding";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getOrgMembership,
  assertMinRole,
} from "../trpc";

/**
 * Lazily populate project_members for all org members the first time
 * project-level membership is explicitly managed (role change or removal).
 */
async function ensureProjectMembersPopulated(
  supabase: Parameters<typeof getOrgMembership>[0],
  organizationId: string,
  projectId: string,
) {
  const { count } = await supabase
    .from("project_members")
    .select("id", { count: "exact", head: true })
    .eq("projectId", projectId);

  if ((count ?? 0) > 0) return;

  const { data: orgMembers } = await supabase
    .from("organization_members")
    .select("userId, role")
    .eq("workspaceId", organizationId);

  if (!orgMembers || orgMembers.length === 0) return;

  await supabase.from("project_members").insert(
    orgMembers.map((m) => ({
      projectId,
      userId: m.userId,
      role: m.role,
    })),
  );
}

export const orgMemberRouter = router({
  list: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const membership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        ctx.user.id,
      );
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { data: members } = await ctx.supabase
        .from("organization_members")
        .select("id, userId, role, joinedAt")
        .eq("workspaceId", input.organizationId)
        .order("joinedAt", { ascending: true });

      const rows = members ?? [];
      if (rows.length === 0) return [];

      const userIds = rows.map((m) => m.userId);
      const { data: profiles } = await ctx.supabase
        .from("profiles")
        .select("id, email, name, avatar")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      return rows.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role as string,
        joinedAt: m.joinedAt,
        profile: (profileMap.get(m.userId) as {
          id: string;
          email: string;
          name: string | null;
          avatar: string | null;
        }) ?? null,
      }));
    }),

  invite: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        email: z.string().email(),
        role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        ctx.user.id,
      );
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      assertMinRole(membership.role, "ADMIN");

      if (membership.role === "ADMIN" && input.role === "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the organization owner can invite another admin.",
        });
      }

      const normalizedEmail = input.email.trim().toLowerCase();
      const { data: organization } = await ctx.supabase
        .from("organizations")
        .select("id, name")
        .eq("id", input.organizationId)
        .single();

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found.",
        });
      }

      const { data: existingProfile } = await ctx.supabase
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      let invitedAuthUserId: string | null = null;
      let userId = existingProfile?.id ?? null;

      if (!userId) {
        const appUrl = (
          process.env.NEXT_PUBLIC_APP_URL ?? "https://assessment.skilio.co"
        ).replace(/\/$/, "");
        const { data: invitation, error: invitationError } =
          await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
            data: {
              full_name: getInviteDisplayName(normalizedEmail),
              invited_organization_id: organization.id,
              invited_organization_name: organization.name,
              skip_default_organization: true,
            },
            redirectTo: `${appUrl}/auth/confirm?next=/auth/accept-invite`,
          });

        if (invitationError || !invitation.user) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              invitationError?.message ??
              "The invitation could not be sent. Try again.",
          });
        }

        invitedAuthUserId = invitation.user.id;
        userId = invitation.user.id;
      }

      const existing = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        userId,
      );
      if (existing) {
        if (invitedAuthUserId) {
          await supabaseAdmin.auth.admin.deleteUser(invitedAuthUserId);
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "This person already belongs to the organization.",
        });
      }

      const { data: member, error } = await ctx.supabase
        .from("organization_members")
        .insert({
          workspaceId: input.organizationId,
          userId,
          role: input.role,
        })
        .select()
        .single();

      if (error || !member) {
        if (invitedAuthUserId) {
          await supabaseAdmin.auth.admin.deleteUser(invitedAuthUserId);
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "The teammate could not be added.",
        });
      }

      const { data: projects } = await ctx.supabase
        .from("projects")
        .select("id")
        .eq("organizationId", input.organizationId);

      if (projects && projects.length > 0) {
        const { error: projectAccessError } = await ctx.supabase
          .from("project_members")
          .upsert(
            projects.map((project) => ({
              projectId: project.id,
              userId,
              role: input.role,
            })),
            { onConflict: "projectId,userId" },
          );

        if (projectAccessError) {
          await ctx.supabase
            .from("organization_members")
            .delete()
            .eq("workspaceId", input.organizationId)
            .eq("userId", userId);
          if (invitedAuthUserId) {
            await supabaseAdmin.auth.admin.deleteUser(invitedAuthUserId);
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: projectAccessError.message,
          });
        }
      }

      const { data: profile } = await ctx.supabase
        .from("profiles")
        .select("id, email, name, avatar")
        .eq("id", userId)
        .maybeSingle();

      return {
        member: {
          ...member,
          profile: profile ?? {
            id: userId,
            email: normalizedEmail,
            name: getInviteDisplayName(normalizedEmail),
            avatar: null,
          },
        },
        invitationSent: Boolean(invitedAuthUserId),
      };
    }),

  updateRole: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
        role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const callerMembership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        ctx.user.id,
      );
      if (!callerMembership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      assertMinRole(callerMembership.role, "ADMIN");

      const targetMembership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        input.userId,
      );
      if (!targetMembership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      if (targetMembership.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot change the role of the organization owner",
        });
      }

      // Admins cannot promote to ADMIN (only owners can)
      if (
        callerMembership.role === "ADMIN" &&
        input.role === "ADMIN" &&
        targetMembership.role !== "ADMIN"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the owner can promote members to Admin",
        });
      }

      const { data: projects } = await ctx.supabase
        .from("projects")
        .select("id")
        .eq("organizationId", input.organizationId);
      const projectIds = (projects ?? []).map((project) => project.id);

      const { error } = await ctx.supabase
        .from("organization_members")
        .update({ role: input.role })
        .eq("workspaceId", input.organizationId)
        .eq("userId", input.userId);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      if (projectIds.length > 0) {
        const { error: projectRoleError } = await ctx.supabase
          .from("project_members")
          .update({ role: input.role })
          .eq("userId", input.userId)
          .in("projectId", projectIds);

        if (projectRoleError) {
          await ctx.supabase
            .from("organization_members")
            .update({ role: targetMembership.role })
            .eq("workspaceId", input.organizationId)
            .eq("userId", input.userId);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: projectRoleError.message,
          });
        }
      }

      return { success: true };
    }),

  remove: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const callerMembership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        ctx.user.id,
      );
      if (!callerMembership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      assertMinRole(callerMembership.role, "ADMIN");

      const targetMembership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        input.userId,
      );
      if (!targetMembership) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (targetMembership.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot remove the organization owner",
        });
      }

      const { data: projects } = await ctx.supabase
        .from("projects")
        .select("id")
        .eq("organizationId", input.organizationId);
      const projectIds = (projects ?? []).map((project) => project.id);

      if (projectIds.length > 0) {
        await ctx.supabase
          .from("project_members")
          .delete()
          .eq("userId", input.userId)
          .in("projectId", projectIds);
      }

      await ctx.supabase
        .from("organization_members")
        .delete()
        .eq("workspaceId", input.organizationId)
        .eq("userId", input.userId);

      return { success: true };
    }),

  listProjectRoles: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const membership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        ctx.user.id,
      );
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { data: projectMembers } = await ctx.supabase
        .from("project_members")
        .select("userId, role")
        .eq("projectId", input.projectId);

      const map: Record<string, string> = {};
      for (const pm of projectMembers ?? []) {
        map[pm.userId] = pm.role;
      }
      return map;
    }),

  updateProjectRole: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        projectId: z.string(),
        userId: z.string(),
        role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const callerMembership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        ctx.user.id,
      );
      if (!callerMembership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      assertMinRole(callerMembership.role, "ADMIN");

      await ensureProjectMembersPopulated(
        ctx.supabase,
        input.organizationId,
        input.projectId,
      );

      const { error } = await ctx.supabase
        .from("project_members")
        .upsert(
          {
            projectId: input.projectId,
            userId: input.userId,
            role: input.role,
          },
          { onConflict: "projectId,userId" },
        );

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return { success: true };
    }),

  addProjectMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        projectId: z.string(),
        email: z.string().email(),
        role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const callerMembership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        ctx.user.id,
      );
      if (!callerMembership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      assertMinRole(callerMembership.role, "ADMIN");

      const { data: profile } = await ctx.supabase
        .from("profiles")
        .select("id")
        .eq("email", input.email)
        .single();

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user found with that email. They must sign up first.",
        });
      }

      const orgMembership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        profile.id,
      );
      if (!orgMembership) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "User is not a member of this organization. Invite them to the organization first.",
        });
      }

      await ensureProjectMembersPopulated(
        ctx.supabase,
        input.organizationId,
        input.projectId,
      );

      const { data: existing } = await ctx.supabase
        .from("project_members")
        .select("id")
        .eq("projectId", input.projectId)
        .eq("userId", profile.id)
        .single();

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this project",
        });
      }

      const { error } = await ctx.supabase.from("project_members").insert({
        projectId: input.projectId,
        userId: profile.id,
        role: input.role,
      });

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return { success: true };
    }),

  removeProjectMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        projectId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const callerMembership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        ctx.user.id,
      );
      if (!callerMembership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      assertMinRole(callerMembership.role, "ADMIN");

      await ensureProjectMembersPopulated(
        ctx.supabase,
        input.organizationId,
        input.projectId,
      );

      await ctx.supabase
        .from("project_members")
        .delete()
        .eq("projectId", input.projectId)
        .eq("userId", input.userId);

      return { success: true };
    }),

  leave: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await getOrgMembership(
        ctx.supabase,
        input.organizationId,
        ctx.user.id,
      );
      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (membership.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Organization owner cannot leave. Transfer ownership or delete the organization.",
        });
      }

      const { data: projects } = await ctx.supabase
        .from("projects")
        .select("id")
        .eq("organizationId", input.organizationId);
      const projectIds = (projects ?? []).map((project) => project.id);

      if (projectIds.length > 0) {
        await ctx.supabase
          .from("project_members")
          .delete()
          .eq("userId", ctx.user.id)
          .in("projectId", projectIds);
      }

      await ctx.supabase
        .from("organization_members")
        .delete()
        .eq("workspaceId", input.organizationId)
        .eq("userId", ctx.user.id);

      return { success: true };
    }),
});
