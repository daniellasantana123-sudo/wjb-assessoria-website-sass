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
/** Sistemas dos quais uma obrigação pode vir espelhada (migration 0020). */
export type ExternalObligationSource = "omie_gclick";
export type DocumentCategory = "documento" | "guia";
/** 7 etapas do funil comercial desde a migration 0023 (2026-11-09). */
export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost";
export type TicketStatus = "open" | "in_progress" | "closed";
export type AccountStatus = "active" | "suspended";
export type FeatureFlagKey = "omie_gclick" | "documents" | "notifications";
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
          status: AccountStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          cnpj?: string | null;
          status?: AccountStatus;
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
          /* 0020 — origem externa; nulo = lançada à mão pela WJB. */
          external_id: string | null;
          external_source: ExternalObligationSource | null;
          external_synced_at: string | null;
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
          external_id?: string | null;
          external_source?: ExternalObligationSource | null;
          external_synced_at?: string | null;
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
      fiscal_requests: {
        Row: {
          id: string;
          tenant_id: string;
          document_type: string;
          status: string;
          idempotency_key: string;
          draft_snapshot: Record<string, unknown>;
          draft_hash: string;
          policy_decision: string | null;
          policy_reasons: string[];
          channel: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          attempt_count: number;
          next_attempt_at: string | null;
          last_error: string | null;
          needs_intervention: boolean;
          assigned_to: string | null;
          priority: string;
          review_due_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          document_type?: string;
          status?: string;
          idempotency_key: string;
          draft_snapshot: Record<string, unknown>;
          draft_hash: string;
          policy_decision?: string | null;
          policy_reasons?: string[];
          channel?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          attempt_count?: number;
          next_attempt_at?: string | null;
          last_error?: string | null;
          needs_intervention?: boolean;
          assigned_to?: string | null;
          priority?: string;
          review_due_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_requests"]["Insert"]>;
        Relationships: [];
      };
      fiscal_request_events: {
        Row: {
          id: number;
          request_id: string;
          tenant_id: string;
          from_status: string | null;
          to_status: string;
          actor_id: string | null;
          actor_kind: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          request_id: string;
          tenant_id: string;
          from_status?: string | null;
          to_status: string;
          actor_id?: string | null;
          actor_kind?: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_request_events"]["Insert"]>;
        Relationships: [];
      };
      fiscal_issuance_attempts: {
        Row: {
          id: string;
          request_id: string;
          tenant_id: string;
          environment: string;
          idempotency_key: string;
          outcome: string;
          official_reference: string | null;
          rejection_code: string | null;
          simulated: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          tenant_id: string;
          environment: string;
          idempotency_key: string;
          outcome: string;
          official_reference?: string | null;
          rejection_code?: string | null;
          simulated: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_issuance_attempts"]["Insert"]>;
        Relationships: [];
      };
      fiscal_profile_approver_grants: {
        Row: {
          id: string;
          profile_id: string;
          tenant_id: string | null;
          reason: string;
          granted_by: string;
          granted_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
          revoke_reason: string | null;
        };
        Insert: { id?: string; profile_id: string; tenant_id?: string | null; reason: string; granted_by: string };
        Update: Partial<Database["public"]["Tables"]["fiscal_profile_approver_grants"]["Insert"]>;
        Relationships: [];
      };
      fiscal_profile_approvals: {
        Row: {
          id: string;
          fiscal_profile_id: string;
          tenant_id: string;
          profile_version: number;
          approved_by: string;
          approved_at: string;
          justification: string;
        };
        Insert: { id?: string; fiscal_profile_id: string; tenant_id: string; profile_version: number; approved_by: string; justification: string };
        Update: Partial<Database["public"]["Tables"]["fiscal_profile_approvals"]["Insert"]>;
        Relationships: [];
      };
      fiscal_request_versions: {
        Row: {
          id: string;
          request_id: string;
          tenant_id: string;
          version: number;
          draft_snapshot: Record<string, unknown>;
          draft_hash: string;
          replaced_by: string | null;
          replaced_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          tenant_id: string;
          version: number;
          draft_snapshot: Record<string, unknown>;
          draft_hash: string;
          replaced_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_request_versions"]["Insert"]>;
        Relationships: [];
      };
      fiscal_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          version: number;
          status: string;
          municipality_ibge_code: string | null;
          service_settings: Record<string, unknown>;
          max_amount_cents_without_review: number;
          approved_by: string | null;
          approved_at: string | null;
          approval_justification: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          version?: number;
          status?: string;
          municipality_ibge_code?: string | null;
          service_settings?: Record<string, unknown>;
          max_amount_cents_without_review?: number;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_profiles"]["Insert"]>;
        Relationships: [];
      };
      fiscal_authorization_grants: {
        Row: {
          id: string;
          tenant_id: string;
          kind: string;
          scope: string;
          status: string;
          valid_until: string;
          evidence_reference: string | null;
          certificate_vault_reference: string | null;
          registered_by: string | null;
          created_at: string;
          emission_model: string | null;
          certificate_holder_document: string | null;
          certificate_valid_from: string | null;
          certificate_valid_until: string | null;
          certificate_fingerprint_sha256: string | null;
          certificate_kind: string | null;
          certificate_requirements_confirmed: boolean;
          revoked_at: string | null;
          revoked_by: string | null;
          revoke_reason: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          kind: string;
          scope: string;
          status?: string;
          valid_until: string;
          evidence_reference?: string | null;
          certificate_vault_reference?: string | null;
          registered_by?: string | null;
          emission_model?: string | null;
          certificate_holder_document?: string | null;
          certificate_valid_from?: string | null;
          certificate_valid_until?: string | null;
          certificate_fingerprint_sha256?: string | null;
          certificate_kind?: string | null;
          certificate_requirements_confirmed?: boolean;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_authorization_grants"]["Insert"]>;
        Relationships: [];
      };
      fiscal_dps_series: {
        Row: {
          id: string;
          tenant_id: string;
          environment: string;
          emitter_document: string;
          series: number;
          last_number: number;
          active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      commercial_plans: {
        Row: { id: string; sku: string; product: string; name: string; description: string; monthly_cents: number | null; quota: number | null; overage_cents: number | null; status: string; version: number; updated_by: string | null; updated_at: string; approved_at: string | null; approved_by: string | null; approval_reference: string | null; effective_from: string | null };
        Insert: { id?: string; sku: string; product: string; name: string; description?: string; monthly_cents?: number | null; quota?: number | null; overage_cents?: number | null; status?: string; approval_reference?: string | null; effective_from?: string | null };
        Update: Partial<Database["public"]["Tables"]["commercial_plans"]["Insert"]>;
        Relationships: [];
      };
      commercial_plan_changes: {
        Row: { id: number; plan_id: string; changed_by: string | null; before: Record<string, unknown> | null; after: Record<string, unknown>; changed_at: string };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      commercial_settings: {
        Row: { key: string; value: unknown; updated_by: string | null; updated_at: string };
        Insert: { key: string; value: unknown; updated_by?: string | null };
        Update: { value?: unknown; updated_by?: string | null };
        Relationships: [];
      };
      commercial_setting_changes: {
        Row: { id: number; key: string; before: unknown; after: unknown; changed_by: string | null; changed_at: string };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      commercial_accounts: {
        Row: { tenant_id: string; relationship: string; created_at: string };
        Insert: { tenant_id: string; relationship: string };
        Update: { relationship?: string };
        Relationships: [];
      };
      commercial_subscriptions: {
        Row: { id: string; tenant_id: string; plan_id: string; mode: string; plan_sku: string; monthly_cents: number | null; quota: number | null; overage_cents: number | null; discount_bp: number; status: string; cycle_start: string; cycle_end: string; overage_authorized: boolean; spending_limit_cents: number | null; pending_plan_id: string | null; created_by: string | null; created_at: string; canceled_at: string | null; cancel_reason: string | null; provider_subscription_id: string | null; current_period_end: string | null; cancel_at_period_end: boolean };
        Insert: { id?: string; tenant_id: string; plan_id: string; plan_sku: string; mode?: string; provider_subscription_id?: string | null; current_period_end?: string | null; cancel_at_period_end?: boolean; monthly_cents?: number | null; quota?: number | null; overage_cents?: number | null; discount_bp?: number; status?: string; cycle_start: string; cycle_end: string; overage_authorized?: boolean; spending_limit_cents?: number | null; pending_plan_id?: string | null; created_by?: string | null; canceled_at?: string | null; cancel_reason?: string | null };
        Update: Partial<Database["public"]["Tables"]["commercial_subscriptions"]["Insert"]>;
        Relationships: [];
      };
      commercial_acceptances: {
        Row: { id: number; tenant_id: string; subscription_id: string | null; user_id: string | null; document: string; document_version: string; accepted_at: string };
        Insert: { tenant_id: string; subscription_id?: string | null; user_id?: string | null; document: string; document_version: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      payment_customers: {
        Row: { tenant_id: string; provider: string; mode: string; provider_customer_id: string; created_at: string };
        Insert: { tenant_id: string; mode: string; provider_customer_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      payment_prices: {
        Row: { id: string; plan_id: string; plan_version: number; mode: string; discount_bp: number; unit_amount_cents: number; provider_price_id: string; provider_product_id: string; created_at: string };
        Insert: { plan_id: string; plan_version: number; mode: string; discount_bp: number; unit_amount_cents: number; provider_price_id: string; provider_product_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      payment_checkouts: {
        Row: { id: string; tenant_id: string; subscription_id: string; plan_id: string; plan_version: number; kind: string; mode: string; provider_session_id: string | null; amount_cents: number; discount_bp: number; status: string; created_by: string | null; created_at: string; completed_at: string | null };
        Insert: { id?: string; tenant_id: string; subscription_id: string; plan_id: string; plan_version: number; kind: string; mode: string; provider_session_id?: string | null; amount_cents: number; discount_bp: number; status?: string; created_by?: string | null };
        Update: { provider_session_id?: string | null; status?: string; completed_at?: string | null };
        Relationships: [];
      };
      payment_events: {
        Row: { provider_event_id: string; mode: string; type: string; livemode: boolean; object_id: string | null; tenant_id: string | null; status: string; attempts: number; last_error: string | null; received_at: string; processed_at: string | null };
        Insert: { provider_event_id: string; mode: string; type: string; livemode?: boolean; object_id?: string | null; tenant_id?: string | null; status?: string };
        Update: { status?: string; attempts?: number; last_error?: string | null; processed_at?: string | null; tenant_id?: string | null };
        Relationships: [];
      };
      payment_invoices: {
        Row: { provider_invoice_id: string; tenant_id: string; subscription_id: string | null; mode: string; status: string; currency: string; amount_due_cents: number; amount_paid_cents: number; amount_refunded_cents: number; disputed: boolean; period_start: string | null; period_end: string | null; hosted_invoice_url: string | null; created_at: string; updated_at: string };
        Insert: { provider_invoice_id: string; tenant_id: string; subscription_id?: string | null; mode: string; status: string; amount_due_cents?: number; amount_paid_cents?: number; amount_refunded_cents?: number; disputed?: boolean; period_start?: string | null; period_end?: string | null; hosted_invoice_url?: string | null; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["payment_invoices"]["Insert"]>;
        Relationships: [];
      };
      payment_mock_objects: {
        Row: { id: string; type: string; data: Record<string, unknown>; updated_at: string };
        Insert: { id: string; type: string; data: Record<string, unknown>; updated_at?: string };
        Update: { data?: Record<string, unknown>; updated_at?: string };
        Relationships: [];
      };
      commercial_usage_ledger: {
        Row: { id: number; tenant_id: string; subscription_id: string | null; request_id: string; kind: string; billable: boolean; cycle_start: string; created_at: string };
        Insert: { tenant_id: string; subscription_id?: string | null; request_id: string; kind: string; billable?: boolean; cycle_start: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      fiscal_certificate_usage: {
        Row: {
          id: number;
          tenant_id: string;
          request_id: string | null;
          grant_id: string | null;
          emission_model: string | null;
          certificate_fingerprint: string | null;
          purpose: string;
          environment: string;
          outcome: string;
          reason: string | null;
          used_at: string;
        };
        Insert: {
          tenant_id: string;
          request_id?: string | null;
          grant_id?: string | null;
          emission_model?: string | null;
          certificate_fingerprint?: string | null;
          purpose: string;
          environment: string;
          outcome: string;
          reason?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      fiscal_dps_numbers: {
        Row: {
          request_id: string;
          tenant_id: string;
          series_id: string;
          environment: string;
          emitter_document: string;
          series: number;
          number: number;
          allocated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
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
          submission_id: string | null;
          landing_page: string | null;
          utm_term: string | null;
          utm_content: string | null;
          gclid: string | null;
          assigned_to: string | null;
          next_step: string | null;
          status_changed_at: string | null;
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
          submission_id?: string | null;
          landing_page?: string | null;
          utm_term?: string | null;
          utm_content?: string | null;
          gclid?: string | null;
          assigned_to?: string | null;
          next_step?: string | null;
          status_changed_at?: string | null;
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
          title: string;
          body: string;
          link: string;
          metadata_sanitized: Record<string, unknown> | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          tenant_id?: string | null;
          type: string;
          title?: string;
          body: string;
          link: string;
          metadata_sanitized?: Record<string, unknown> | null;
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
      feature_flags: {
        Row: {
          key: string;
          enabled: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          enabled?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feature_flags"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "feature_flags_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_approve_fiscal_profile: { Args: { check_tenant_id: string }; Returns: boolean };
      grant_fiscal_profile_approver: {
        Args: { p_profile_id: string; p_tenant_id: string | null; p_reason: string };
        Returns: string;
      };
      revoke_fiscal_profile_approver: { Args: { p_grant_id: string; p_reason: string }; Returns: undefined };
      approve_fiscal_profile: { Args: { p_fiscal_profile_id: string; p_justification: string }; Returns: undefined };
      configure_dps_series: {
        Args: { p_tenant_id: string; p_environment: string; p_emitter_document: string; p_series: number };
        Returns: string;
      };
      has_entitlement: { Args: { p_tenant_id: string; p_feature: string }; Returns: boolean };
      allocate_dps_number: {
        Args: { p_request_id: string; p_environment: string };
        Returns: { series: number; number: number; emitter_document: string }[];
      };
    };
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
