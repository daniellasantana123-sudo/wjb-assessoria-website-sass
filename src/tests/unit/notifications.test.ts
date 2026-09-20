import { beforeEach, describe, expect, it, vi } from "vitest";

const isFeatureEnabledMock = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: isFeatureEnabledMock }));

vi.mock("@/lib/seo/site-url", () => ({
  getSiteUrl: () => "https://wjbassessoriacontabil.com.br",
}));

const sendEmailMock = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/integrations/email", () => ({ getEmailAdapter: () => ({ send: sendEmailMock }) }));

const notificationsInsertMock = vi.fn().mockResolvedValue({ error: null });
const tenantMembersEqMock = vi.fn();
const staffProfilesEqMock = vi.fn();
const adminFromMock = vi.fn((table: string) => {
  if (table === "notifications") return { insert: notificationsInsertMock };
  if (table === "tenant_members") return { select: () => ({ eq: tenantMembersEqMock }) };
  if (table === "profiles") return { select: () => ({ eq: staffProfilesEqMock }) };
  throw new Error(`tabela inesperada (admin): ${table}`);
});
vi.mock("@/lib/db/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}));

let currentUserId: string | null = "user-1";
const listLimitMock = vi.fn();
const countIsMock = vi.fn();
const linkMaybeSingleMock = vi.fn();
const updateAllIsMock = vi.fn().mockResolvedValue({ error: null });
const updateOneIsMock = vi.fn().mockResolvedValue({ error: null });

const serverFromMock = vi.fn((table: string) => {
  if (table !== "notifications") throw new Error(`tabela inesperada (server): ${table}`);
  return {
    select: (columns: string) => {
      if (columns === "link") return { eq: () => ({ maybeSingle: linkMaybeSingleMock }) };
      if (columns === "id") return { eq: () => ({ is: countIsMock }) };
      return { eq: () => ({ order: () => ({ limit: listLimitMock }) }) };
    },
    update: () => ({
      eq: (column: string) => (column === "id" ? { is: updateOneIsMock } : { is: updateAllIsMock }),
    }),
  };
});
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: serverFromMock,
    auth: { getUser: () => Promise.resolve({ data: { user: currentUserId ? { id: currentUserId } : null } }) },
  }),
}));

const {
  notifyTicketOrMessageEvent,
  notifyDocumentAvailable,
  notifyIntegrationStatus,
  notifyAccountSecurity,
  notifyInvitation,
  listNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsReadAndGetLink,
} = await import("@/lib/notifications");

beforeEach(() => {
  vi.clearAllMocks();
  currentUserId = "user-1";
  isFeatureEnabledMock.mockResolvedValue(true);
  notificationsInsertMock.mockResolvedValue({ error: null });
  sendEmailMock.mockResolvedValue({ ok: true });
  updateAllIsMock.mockResolvedValue({ error: null });
  updateOneIsMock.mockResolvedValue({ error: null });
});

describe("notifyInvitation", () => {
  it("insere in-app com título/tipo/link corretos e envia e-mail com assunto genérico", async () => {
    await notifyInvitation({ recipientId: "profile-2", recipientEmail: "novo@empresa.com.br", tenantId: "tenant-1", link: "/portal" });

    expect(notificationsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        recipient_id: "profile-2",
        tenant_id: "tenant-1",
        type: "invitation",
        title: "Você foi convidado(a)",
        link: "/portal",
      }),
    ]);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "novo@empresa.com.br",
        subject: "WJB Assessoria Contábil - Você foi convidado(a)",
      }),
    );
  });

  it("sem e-mail cadastrado, insere in-app mas não tenta enviar e-mail", async () => {
    await notifyInvitation({ recipientId: "profile-2", recipientEmail: null, link: "/portal" });

    expect(notificationsInsertMock).toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("kill switch 'notifications' desligado - nem insere nem envia e-mail", async () => {
    isFeatureEnabledMock.mockResolvedValue(false);

    await notifyInvitation({ recipientId: "profile-2", recipientEmail: "novo@empresa.com.br", link: "/portal" });

    expect(notificationsInsertMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("notifyTicketOrMessageEvent", () => {
  it("staff agindo notifica membros do tenant (exceto o autor) com link do Portal", async () => {
    tenantMembersEqMock.mockResolvedValue({
      data: [
        { profile_id: "member-1", profiles: { email: "a@empresa.com.br" } },
        { profile_id: "staff-actor", profiles: { email: "staff@wjb.com.br" } },
      ],
    });

    await notifyTicketOrMessageEvent({
      tenantId: "tenant-1",
      actorId: "staff-actor",
      actorIsStaff: true,
      type: "ticket.created",
      body: "Novo chamado",
      portalLink: "/portal/suporte/1",
      adminLink: "/admin/tickets/1",
    });

    expect(notificationsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({ recipient_id: "member-1", link: "/portal/suporte/1" }),
    ]);
  });

  it("cliente agindo notifica o time WJB (exceto o autor) com link do Admin", async () => {
    staffProfilesEqMock.mockResolvedValue({
      data: [
        { id: "staff-1", email: "staff1@wjb.com.br" },
        { id: "client-actor", email: "cliente@empresa.com.br" },
      ],
    });

    await notifyTicketOrMessageEvent({
      tenantId: "tenant-1",
      actorId: "client-actor",
      actorIsStaff: false,
      type: "message.sent",
      body: "Nova mensagem",
      portalLink: "/portal/mensagens",
      adminLink: "/admin/mensagens/tenant-1",
    });

    expect(notificationsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({ recipient_id: "staff-1", link: "/admin/mensagens/tenant-1" }),
    ]);
  });

  it("sem destinatário nenhum (só o próprio autor), não insere nada", async () => {
    tenantMembersEqMock.mockResolvedValue({ data: [{ profile_id: "staff-actor", profiles: { email: null } }] });

    await notifyTicketOrMessageEvent({
      tenantId: "tenant-1",
      actorId: "staff-actor",
      actorIsStaff: true,
      type: "ticket.created",
      body: "x",
      portalLink: "/portal",
      adminLink: "/admin",
    });

    expect(notificationsInsertMock).not.toHaveBeenCalled();
  });
});

describe("notifyDocumentAvailable", () => {
  it("staff envia guia - link aponta pro Portal de guias", async () => {
    tenantMembersEqMock.mockResolvedValue({ data: [{ profile_id: "member-1", profiles: { email: null } }] });

    await notifyDocumentAvailable({
      tenantId: "tenant-1",
      actorId: "staff-1",
      actorIsStaff: true,
      fileName: "guia.pdf",
      category: "guia",
    });

    expect(notificationsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({ type: "document_available", link: "/portal/guias" }),
    ]);
  });

  it("cliente envia documento - link aponta pra empresa no Admin", async () => {
    staffProfilesEqMock.mockResolvedValue({ data: [{ id: "staff-1", email: null }] });

    await notifyDocumentAvailable({
      tenantId: "tenant-1",
      actorId: "client-1",
      actorIsStaff: false,
      fileName: "contrato.pdf",
      category: "documento",
    });

    expect(notificationsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({ link: "/admin/empresas/tenant-1" }),
    ]);
  });
});

describe("notifyIntegrationStatus", () => {
  it("notifica todo o staff exceto quem já viu o resultado, sem e-mail", async () => {
    staffProfilesEqMock.mockResolvedValue({
      data: [
        { id: "staff-1", email: "staff1@wjb.com.br" },
        { id: "staff-2", email: "staff2@wjb.com.br" },
      ],
    });

    await notifyIntegrationStatus({ message: "Falha na sincronização", link: "/admin/empresas/1", excludeActorId: "staff-1" });

    expect(notificationsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({ recipient_id: "staff-2", type: "integration_status" }),
    ]);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("notifyAccountSecurity", () => {
  it("envia in-app e e-mail com assunto genérico (nunca revela o motivo no assunto)", async () => {
    await notifyAccountSecurity({
      recipientId: "profile-2",
      recipientEmail: "pessoa@empresa.com.br",
      message: "Sua conta foi suspensa pela WJB.",
      link: "/admin/seguranca",
    });

    expect(notificationsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({ type: "account_security", body: "Sua conta foi suspensa pela WJB." }),
    ]);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "WJB Assessoria Contábil - Alteração de segurança na sua conta" }),
    );
  });
});

describe("listNotifications", () => {
  it("sem sessão, devolve lista vazia", async () => {
    currentUserId = null;
    const result = await listNotifications();
    expect(result).toEqual([]);
  });

  it("mapeia title/metadataSanitized/read corretamente", async () => {
    listLimitMock.mockResolvedValue({
      data: [
        {
          id: "n1",
          type: "document_available",
          title: "Novo documento disponível",
          body: 'Documento enviado: "x.pdf"',
          link: "/portal/documentos",
          metadata_sanitized: { file_name: "x.pdf" },
          read_at: null,
          created_at: "2026-09-20T10:00:00Z",
        },
      ],
    });

    const result = await listNotifications();

    expect(result).toEqual([
      {
        id: "n1",
        type: "document_available",
        title: "Novo documento disponível",
        body: 'Documento enviado: "x.pdf"',
        link: "/portal/documentos",
        metadataSanitized: { file_name: "x.pdf" },
        read: false,
        createdAt: "2026-09-20T10:00:00Z",
      },
    ]);
  });
});

describe("getUnreadNotificationCount", () => {
  it("sem sessão, devolve 0", async () => {
    currentUserId = null;
    expect(await getUnreadNotificationCount()).toBe(0);
  });

  it("devolve a contagem real", async () => {
    countIsMock.mockResolvedValue({ count: 3 });
    expect(await getUnreadNotificationCount()).toBe(3);
  });
});

describe("markAllNotificationsAsRead", () => {
  it("atualiza só as não lidas do próprio usuário", async () => {
    await markAllNotificationsAsRead();
    expect(updateAllIsMock).toHaveBeenCalledWith("read_at", null);
  });

  it("sem sessão, não faz nada", async () => {
    currentUserId = null;
    await markAllNotificationsAsRead();
    expect(updateAllIsMock).not.toHaveBeenCalled();
  });
});

describe("markNotificationAsReadAndGetLink", () => {
  it("notificação inexistente (ou de outra pessoa, via RLS) devolve null sem marcar nada", async () => {
    linkMaybeSingleMock.mockResolvedValue({ data: null });

    const result = await markNotificationAsReadAndGetLink("n1");

    expect(result).toBeNull();
    expect(updateOneIsMock).not.toHaveBeenCalled();
  });

  it("marca como lida e devolve o link", async () => {
    linkMaybeSingleMock.mockResolvedValue({ data: { link: "/portal/suporte/1" } });

    const result = await markNotificationAsReadAndGetLink("n1");

    expect(result).toBe("/portal/suporte/1");
    expect(updateOneIsMock).toHaveBeenCalledWith("read_at", null);
  });
});
