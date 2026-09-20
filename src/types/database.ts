/**
 * Tipos manuais espelhando `supabase/migrations/0001_core_schema.sql`, no
 * mesmo formato que `supabase gen types typescript` gera de verdade.
 * Provisório: quando o projeto Supabase real existir, gerar com
 * `npx supabase gen types typescript --project-id <id> > src/types/database.ts`
 * e este arquivo deixa de ser mantido à mão.
 */

export type TenantMemberRole = "owner" | "member";
export type StaffRole = "super_admin" | "contador" | "atendimento";
export type ObligationStatus = "pending" | "done";
export type DocumentCategory = "documento" | "guia";
export type LeadStatus = "new" | "contacted" | "won" | "lost";
export type TicketStatus = "open" | "in_progress" | "closed";
export type AccountStatus = "active" | "suspended";
export type OmieIntegrationStatus =
  | "not_connected"
  | "pending"
  | "connected"
  | "syncing"
  | "synced"
  | "conflict"
  | "error"
  | "disabled";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          is_wjb_staff: boolean;
          staff_role: StaffRole | null;
          status: AccountStatus;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email: string;
          is_wjb_staff?: boolean;
          staff_role?: StaffRole | null;
          status?: AccountStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          cnpj: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          cnpj?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tenants_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_members: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          role: TenantMemberRole;
          status: AccountStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          profile_id: string;
          role?: TenantMemberRole;
          status?: AccountStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenant_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          tenant_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          tenant_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          tenant_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_by: string | null;
          created_at: string;
          category: DocumentCategory;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
          category?: DocumentCategory;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      obligations: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          description: string | null;
          due_date: string;
          status: ObligationStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          title: string;
          description?: string | null;
          due_date: string;
          status?: ObligationStatus;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["obligations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "obligations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          phone: string | null;
          company: string | null;
          cnpj: string | null;
          city: string | null;
          state: string | null;
          business_activity: string | null;
          service_interest: string | null;
          message: string | null;
          form_context: string;
          source_path: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          status: LeadStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          email: string;
          phone?: string | null;
          company?: string | null;
          cnpj?: string | null;
          city?: string | null;
          state?: string | null;
          business_activity?: string | null;
          service_interest?: string | null;
          message?: string | null;
          form_context: string;
          source_path?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          status?: LeadStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          tenant_id: string;
          subject: string;
          status: TicketStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          subject: string;
          status?: TicketStatus;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tickets"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tickets_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          tenant_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          tenant_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ticket_messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_messages_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          tenant_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "messages_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          tenant_id: string | null;
          type: string;
          body: string;
          link: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          tenant_id?: string | null;
          type: string;
          body: string;
          link: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      omie_client_mappings: {
        Row: {
          id: string;
          tenant_id: string;
          external_client_id: string | null;
          external_portal_url: string | null;
          status: OmieIntegrationStatus;
          last_synced_at: string | null;
          last_error: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          external_client_id?: string | null;
          external_portal_url?: string | null;
          status?: OmieIntegrationStatus;
          last_synced_at?: string | null;
          last_error?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["omie_client_mappings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "omie_client_mappings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "omie_client_mappings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      tenant_member_role: TenantMemberRole;
      staff_role: StaffRole;
      obligation_status: ObligationStatus;
      lead_status: LeadStatus;
      ticket_status: TicketStatus;
      account_status: AccountStatus;
      omie_integration_status: OmieIntegrationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
