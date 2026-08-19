export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_reauth_events: {
        Row: {
          admin_id: string
          id: string
          method: string
          verified_at: string
        }
        Insert: {
          admin_id: string
          id?: string
          method?: string
          verified_at?: string
        }
        Update: {
          admin_id?: string
          id?: string
          method?: string
          verified_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          city: string | null
          client_id: string | null
          created_at: string
          driver_id: string | null
          event: string
          id: string
          metadata: Json | null
        }
        Insert: {
          city?: string | null
          client_id?: string | null
          created_at?: string
          driver_id?: string | null
          event: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          city?: string | null
          client_id?: string | null
          created_at?: string
          driver_id?: string | null
          event?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          resource: string | null
          resource_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          resource?: string | null
          resource_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          resource?: string | null
          resource_id?: string | null
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          accounting_email: string | null
          address: string | null
          address_opt_out: boolean
          archived_at: string | null
          billing_address: string | null
          billing_city: string | null
          billing_email: string | null
          billing_postal_code: string | null
          city: string | null
          client_id: string | null
          contact_name: string | null
          contact_phone: string | null
          country_code: string
          created_at: string
          display_name: string
          driver_id: string
          einvoicing_address: string | null
          foreign_tax_id: string | null
          id: string
          internal_ref: string | null
          kind: string
          legal_name: string | null
          legal_name_match: string
          payment_terms: string
          payment_terms_days: number | null
          po_number: string | null
          postal_code: string | null
          recipient_platform: string | null
          routing_id: string | null
          routing_scheme: string | null
          siren: string | null
          siren_check_status: string
          siren_checked_at: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          accounting_email?: string | null
          address?: string | null
          address_opt_out?: boolean
          archived_at?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_email?: string | null
          billing_postal_code?: string | null
          city?: string | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string
          display_name: string
          driver_id: string
          einvoicing_address?: string | null
          foreign_tax_id?: string | null
          id?: string
          internal_ref?: string | null
          kind?: string
          legal_name?: string | null
          legal_name_match?: string
          payment_terms?: string
          payment_terms_days?: number | null
          po_number?: string | null
          postal_code?: string | null
          recipient_platform?: string | null
          routing_id?: string | null
          routing_scheme?: string | null
          siren?: string | null
          siren_check_status?: string
          siren_checked_at?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          accounting_email?: string | null
          address?: string | null
          address_opt_out?: boolean
          archived_at?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_email?: string | null
          billing_postal_code?: string | null
          city?: string | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string
          display_name?: string
          driver_id?: string
          einvoicing_address?: string | null
          foreign_tax_id?: string | null
          id?: string
          internal_ref?: string | null
          kind?: string
          legal_name?: string | null
          legal_name_match?: string
          payment_terms?: string
          payment_terms_days?: number | null
          po_number?: string | null
          postal_code?: string | null
          recipient_platform?: string | null
          routing_id?: string | null
          routing_scheme?: string | null
          siren?: string | null
          siren_check_status?: string
          siren_checked_at?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      client_addresses: {
        Row: {
          address: string
          client_id: string
          created_at: string
          id: string
          label: string
        }
        Insert: {
          address: string
          client_id: string
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          address?: string
          client_id?: string
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          anticipation_opt_in: boolean
          billing_address: string | null
          billing_city: string | null
          billing_postal_code: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country_code: string
          created_at: string
          driver_id: string
          einvoicing_address: string | null
          einvoicing_opt_in: boolean
          entity_category: string
          entity_category_source: string
          ereporting_enabled: boolean
          id: string
          issue_enabled: boolean
          legal_form: string | null
          legal_name: string | null
          legal_verified_at: string | null
          obligation_start_on: string | null
          pa_account_id: string | null
          pa_environment: string
          pa_last_sync_at: string | null
          pa_provider: string | null
          pa_status: string
          postal_code: string | null
          receive_enabled: boolean
          siren: string | null
          siret: string | null
          updated_at: string
          vat_franchise: boolean | null
          vat_number: string | null
          vat_on_debits: boolean
        }
        Insert: {
          address?: string | null
          anticipation_opt_in?: boolean
          billing_address?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string
          driver_id: string
          einvoicing_address?: string | null
          einvoicing_opt_in?: boolean
          entity_category?: string
          entity_category_source?: string
          ereporting_enabled?: boolean
          id?: string
          issue_enabled?: boolean
          legal_form?: string | null
          legal_name?: string | null
          legal_verified_at?: string | null
          obligation_start_on?: string | null
          pa_account_id?: string | null
          pa_environment?: string
          pa_last_sync_at?: string | null
          pa_provider?: string | null
          pa_status?: string
          postal_code?: string | null
          receive_enabled?: boolean
          siren?: string | null
          siret?: string | null
          updated_at?: string
          vat_franchise?: boolean | null
          vat_number?: string | null
          vat_on_debits?: boolean
        }
        Update: {
          address?: string | null
          anticipation_opt_in?: boolean
          billing_address?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string
          driver_id?: string
          einvoicing_address?: string | null
          einvoicing_opt_in?: boolean
          entity_category?: string
          entity_category_source?: string
          ereporting_enabled?: boolean
          id?: string
          issue_enabled?: boolean
          legal_form?: string | null
          legal_name?: string | null
          legal_verified_at?: string | null
          obligation_start_on?: string | null
          pa_account_id?: string | null
          pa_environment?: string
          pa_last_sync_at?: string | null
          pa_provider?: string | null
          pa_status?: string
          postal_code?: string | null
          receive_enabled?: boolean
          siren?: string | null
          siret?: string | null
          updated_at?: string
          vat_franchise?: boolean | null
          vat_number?: string | null
          vat_on_debits?: boolean
        }
        Relationships: []
      }
      document_reviews: {
        Row: {
          admin_id: string
          created_at: string
          decision: Database["public"]["Enums"]["document_status"]
          document_id: string
          id: string
          note: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          decision: Database["public"]["Enums"]["document_status"]
          document_id: string
          id?: string
          note?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["document_status"]
          document_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_reviews_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "verification_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_admin_notes: {
        Row: {
          admin_id: string
          created_at: string
          driver_id: string
          id: string
          note: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          driver_id: string
          id?: string
          note: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          note?: string
        }
        Relationships: []
      }
      dossier_section_reviews: {
        Row: {
          admin_id: string | null
          created_at: string
          driver_id: string
          id: string
          note: string | null
          section: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          driver_id: string
          id?: string
          note?: string | null
          section: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          note?: string | null
          section?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_absences: {
        Row: {
          created_at: string
          driver_id: string
          ends_on: string
          id: string
          reason: string | null
          starts_on: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          ends_on: string
          id?: string
          reason?: string | null
          starts_on: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          ends_on?: string
          id?: string
          reason?: string | null
          starts_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_breaks: {
        Row: {
          created_at: string
          day: string | null
          driver_id: string
          end_time: string
          id: string
          reason: string | null
          start_time: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          day?: string | null
          driver_id: string
          end_time: string
          id?: string
          reason?: string | null
          start_time: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          day?: string | null
          driver_id?: string
          end_time?: string
          id?: string
          reason?: string | null
          start_time?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: []
      }
      driver_client_connections: {
        Row: {
          client_id: string
          created_at: string
          crm_status: Database["public"]["Enums"]["crm_status"]
          driver_id: string
          id: string
          source: string
        }
        Insert: {
          client_id: string
          created_at?: string
          crm_status?: Database["public"]["Enums"]["crm_status"]
          driver_id: string
          id?: string
          source?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          crm_status?: Database["public"]["Enums"]["crm_status"]
          driver_id?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      driver_day_overrides: {
        Row: {
          available: boolean
          created_at: string
          day: string
          driver_id: string
          end_time: string
          id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          day: string
          driver_id: string
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          day?: string
          driver_id?: string
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_dossier_details: {
        Row: {
          auto_company: string | null
          auto_contract: string | null
          auto_expires_on: string | null
          auto_plate: string | null
          auto_starts_on: string | null
          birth_date: string | null
          certified_at: string | null
          created_at: string
          driver_id: string
          id_doc_expires_on: string | null
          id_doc_type: string | null
          license_categories: string | null
          license_expires_on: string | null
          license_issued_on: string | null
          license_number: string | null
          postal_address: string | null
          rc_company: string | null
          rc_contract: string | null
          rc_expires_on: string | null
          rc_starts_on: string | null
          registration_holder: string | null
          revtc_number: string | null
          siren: string | null
          trade_name: string | null
          updated_at: string
          vtc_authority: string | null
          vtc_expires_on: string | null
          vtc_issued_on: string | null
        }
        Insert: {
          auto_company?: string | null
          auto_contract?: string | null
          auto_expires_on?: string | null
          auto_plate?: string | null
          auto_starts_on?: string | null
          birth_date?: string | null
          certified_at?: string | null
          created_at?: string
          driver_id: string
          id_doc_expires_on?: string | null
          id_doc_type?: string | null
          license_categories?: string | null
          license_expires_on?: string | null
          license_issued_on?: string | null
          license_number?: string | null
          postal_address?: string | null
          rc_company?: string | null
          rc_contract?: string | null
          rc_expires_on?: string | null
          rc_starts_on?: string | null
          registration_holder?: string | null
          revtc_number?: string | null
          siren?: string | null
          trade_name?: string | null
          updated_at?: string
          vtc_authority?: string | null
          vtc_expires_on?: string | null
          vtc_issued_on?: string | null
        }
        Update: {
          auto_company?: string | null
          auto_contract?: string | null
          auto_expires_on?: string | null
          auto_plate?: string | null
          auto_starts_on?: string | null
          birth_date?: string | null
          certified_at?: string | null
          created_at?: string
          driver_id?: string
          id_doc_expires_on?: string | null
          id_doc_type?: string | null
          license_categories?: string | null
          license_expires_on?: string | null
          license_issued_on?: string | null
          license_number?: string | null
          postal_address?: string | null
          rc_company?: string | null
          rc_contract?: string | null
          rc_expires_on?: string | null
          rc_starts_on?: string | null
          registration_holder?: string | null
          revtc_number?: string | null
          siren?: string | null
          trade_name?: string | null
          updated_at?: string
          vtc_authority?: string | null
          vtc_expires_on?: string | null
          vtc_issued_on?: string | null
        }
        Relationships: []
      }
      driver_notes: {
        Row: {
          client_id: string
          created_at: string
          driver_id: string
          id: string
          note: string
        }
        Insert: {
          client_id: string
          created_at?: string
          driver_id: string
          id?: string
          note: string
        }
        Update: {
          client_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          note?: string
        }
        Relationships: []
      }
      driver_profiles: {
        Row: {
          accepting_requests: boolean
          admin_note: string | null
          airports: string[]
          approved_at: string | null
          approved_by: string | null
          availability: string[]
          billing_legal_info: string | null
          bio: string | null
          booking_notice: string | null
          booking_theme: string
          brand_cover_path: string | null
          brand_display_name: string | null
          brand_logo_path: string | null
          brand_welcome_message: string | null
          business_name: string | null
          city: string | null
          created_at: string
          expiry_notified_at: string | null
          facebook_url: string | null
          instagram_url: string | null
          languages: string[]
          linkedin_url: string | null
          long_distance: boolean
          on_duty: boolean
          page_published: boolean
          payment_methods: string[]
          professional_address: string | null
          public_intro: string | null
          public_phone: string | null
          rejection_reason: string | null
          service_areas: string[]
          services: string[]
          show_public_phone: boolean
          show_whatsapp: boolean
          siret: string | null
          slug: string
          stations: string[]
          submitted_at: string | null
          suspended_at: string | null
          suspension_reason: string | null
          theme_updated_at: string | null
          tiktok_url: string | null
          updated_at: string
          user_id: string
          vat_applicable: boolean
          verification_status: Database["public"]["Enums"]["verification_status"]
          vtc_card_number: string | null
          whatsapp_number: string | null
          women_for_women_eligible: boolean
          women_for_women_verified_at: string | null
          women_for_women_verified_by: string | null
          zone: string | null
        }
        Insert: {
          accepting_requests?: boolean
          admin_note?: string | null
          airports?: string[]
          approved_at?: string | null
          approved_by?: string | null
          availability?: string[]
          billing_legal_info?: string | null
          bio?: string | null
          booking_notice?: string | null
          booking_theme?: string
          brand_cover_path?: string | null
          brand_display_name?: string | null
          brand_logo_path?: string | null
          brand_welcome_message?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          expiry_notified_at?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          languages?: string[]
          linkedin_url?: string | null
          long_distance?: boolean
          on_duty?: boolean
          page_published?: boolean
          payment_methods?: string[]
          professional_address?: string | null
          public_intro?: string | null
          public_phone?: string | null
          rejection_reason?: string | null
          service_areas?: string[]
          services?: string[]
          show_public_phone?: boolean
          show_whatsapp?: boolean
          siret?: string | null
          slug: string
          stations?: string[]
          submitted_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          theme_updated_at?: string | null
          tiktok_url?: string | null
          updated_at?: string
          user_id: string
          vat_applicable?: boolean
          verification_status?: Database["public"]["Enums"]["verification_status"]
          vtc_card_number?: string | null
          whatsapp_number?: string | null
          women_for_women_eligible?: boolean
          women_for_women_verified_at?: string | null
          women_for_women_verified_by?: string | null
          zone?: string | null
        }
        Update: {
          accepting_requests?: boolean
          admin_note?: string | null
          airports?: string[]
          approved_at?: string | null
          approved_by?: string | null
          availability?: string[]
          billing_legal_info?: string | null
          bio?: string | null
          booking_notice?: string | null
          booking_theme?: string
          brand_cover_path?: string | null
          brand_display_name?: string | null
          brand_logo_path?: string | null
          brand_welcome_message?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          expiry_notified_at?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          languages?: string[]
          linkedin_url?: string | null
          long_distance?: boolean
          on_duty?: boolean
          page_published?: boolean
          payment_methods?: string[]
          professional_address?: string | null
          public_intro?: string | null
          public_phone?: string | null
          rejection_reason?: string | null
          service_areas?: string[]
          services?: string[]
          show_public_phone?: boolean
          show_whatsapp?: boolean
          siret?: string | null
          slug?: string
          stations?: string[]
          submitted_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          theme_updated_at?: string | null
          tiktok_url?: string | null
          updated_at?: string
          user_id?: string
          vat_applicable?: boolean
          verification_status?: Database["public"]["Enums"]["verification_status"]
          vtc_card_number?: string | null
          whatsapp_number?: string | null
          women_for_women_eligible?: boolean
          women_for_women_verified_at?: string | null
          women_for_women_verified_by?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      driver_schedule_settings: {
        Row: {
          buffer_min: number
          created_at: string
          driver_id: string
          updated_at: string
        }
        Insert: {
          buffer_min?: number
          created_at?: string
          driver_id: string
          updated_at?: string
        }
        Update: {
          buffer_min?: number
          created_at?: string
          driver_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_tariff_migrations: {
        Row: {
          created_at: string
          decision: string
          driver_id: string
          id: string
          new_minimum_ht: number
          new_price_per_km_ht: number
          previous_basis: string
          previous_minimum: number | null
          previous_price_per_km: number | null
          vat_rate: number | null
        }
        Insert: {
          created_at?: string
          decision: string
          driver_id: string
          id?: string
          new_minimum_ht: number
          new_price_per_km_ht: number
          previous_basis: string
          previous_minimum?: number | null
          previous_price_per_km?: number | null
          vat_rate?: number | null
        }
        Update: {
          created_at?: string
          decision?: string
          driver_id?: string
          id?: string
          new_minimum_ht?: number
          new_price_per_km_ht?: number
          previous_basis?: string
          previous_minimum?: number | null
          previous_price_per_km?: number | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      driver_tariffs: {
        Row: {
          basis: string
          basis_confirmed_at: string | null
          created_at: string
          driver_id: string
          minimum_ht: number
          price_per_km_ht: number
          updated_at: string
        }
        Insert: {
          basis?: string
          basis_confirmed_at?: string | null
          created_at?: string
          driver_id: string
          minimum_ht?: number
          price_per_km_ht?: number
          updated_at?: string
        }
        Update: {
          basis?: string
          basis_confirmed_at?: string | null
          created_at?: string
          driver_id?: string
          minimum_ht?: number
          price_per_km_ht?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_tax_profiles: {
        Row: {
          confirmed_at: string
          created_at: string
          created_by: string | null
          driver_id: string
          effective_from: string
          id: string
          legal_mention: string | null
          rate_label: string | null
          regime: string
          vat_number: string | null
          vat_rate: number | null
        }
        Insert: {
          confirmed_at?: string
          created_at?: string
          created_by?: string | null
          driver_id: string
          effective_from: string
          id?: string
          legal_mention?: string | null
          rate_label?: string | null
          regime: string
          vat_number?: string | null
          vat_rate?: number | null
        }
        Update: {
          confirmed_at?: string
          created_at?: string
          created_by?: string | null
          driver_id?: string
          effective_from?: string
          id?: string
          legal_mention?: string | null
          rate_label?: string | null
          regime?: string
          vat_number?: string | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      driver_working_hours: {
        Row: {
          active: boolean
          driver_id: string
          end_time: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          driver_id: string
          end_time?: string
          start_time?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          driver_id?: string
          end_time?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      ereporting_submissions: {
        Row: {
          ack_code: string | null
          ack_message: string | null
          created_at: string
          currency: string
          driver_id: string
          external_id: string | null
          id: string
          invoice_id: string | null
          kind: string
          pa_provider: string | null
          payload: Json | null
          period_end: string | null
          period_start: string | null
          status: string
          total_ht: number
          total_ttc: number
          total_vat: number
          updated_at: string
        }
        Insert: {
          ack_code?: string | null
          ack_message?: string | null
          created_at?: string
          currency?: string
          driver_id: string
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          kind: string
          pa_provider?: string | null
          payload?: Json | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          total_ht?: number
          total_ttc?: number
          total_vat?: number
          updated_at?: string
        }
        Update: {
          ack_code?: string | null
          ack_message?: string | null
          created_at?: string
          currency?: string
          driver_id?: string
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          pa_provider?: string | null
          payload?: Json | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          total_ht?: number
          total_ttc?: number
          total_vat?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ereporting_submissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          document_type: string
          driver_id: string
          last_number: number
          updated_at: string
          year: number
        }
        Insert: {
          document_type?: string
          driver_id: string
          last_number?: number
          updated_at?: string
          year: number
        }
        Update: {
          document_type?: string
          driver_id?: string
          last_number?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      invoice_documents: {
        Row: {
          byte_size: number | null
          content_type: string | null
          driver_id: string
          generated_at: string
          id: string
          invoice_id: string
          kind: string
          path: string
          profile: string | null
          sha256: string
          spec_version: string | null
        }
        Insert: {
          byte_size?: number | null
          content_type?: string | null
          driver_id: string
          generated_at?: string
          id?: string
          invoice_id: string
          kind: string
          path: string
          profile?: string | null
          sha256: string
          spec_version?: string | null
        }
        Update: {
          byte_size?: number | null
          content_type?: string | null
          driver_id?: string
          generated_at?: string
          id?: string
          invoice_id?: string
          kind?: string
          path?: string
          profile?: string | null
          sha256?: string
          spec_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: Json | null
          driver_id: string
          event: string
          id: string
          invoice_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          driver_id: string
          event: string
          id?: string
          invoice_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          driver_id?: string
          event?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_transmissions: {
        Row: {
          ack_code: string | null
          ack_message: string | null
          channel: string
          detail: Json | null
          direction: string
          driver_id: string
          external_id: string | null
          id: string
          invoice_id: string
          occurred_at: string
          pa_provider: string | null
          status: string
        }
        Insert: {
          ack_code?: string | null
          ack_message?: string | null
          channel: string
          detail?: Json | null
          direction?: string
          driver_id: string
          external_id?: string | null
          id?: string
          invoice_id: string
          occurred_at?: string
          pa_provider?: string | null
          status?: string
        }
        Update: {
          ack_code?: string | null
          ack_message?: string | null
          channel?: string
          detail?: Json | null
          direction?: string
          driver_id?: string
          external_id?: string | null
          id?: string
          invoice_id?: string
          occurred_at?: string
          pa_provider?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_transmissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number | null
          amount_ht: number
          amount_paid: number
          amount_ttc: number
          auto_generated: boolean
          client_id: string | null
          created_at: string
          credit_note_of: string | null
          currency: string
          customer_id: string | null
          customer_kind: string
          customer_snapshot: Json | null
          description: string | null
          discount_ht: number
          document_hash: string | null
          document_type: string
          documents_generated_at: string | null
          driver_id: string
          due_on: string | null
          external_id: string | null
          facturx_profile: string | null
          facturx_spec_version: string | null
          id: string
          issued_at: string | null
          issued_number_year: number | null
          issued_on: string
          issuer_snapshot: Json | null
          late_penalty_applicable: boolean
          legacy_pre_reform: boolean
          number: string | null
          operation_category: string
          paid_at: string | null
          passenger_name: string | null
          payment_method: string | null
          payment_terms: string
          payment_terms_days: number | null
          pdf_hash: string | null
          pdf_path: string | null
          po_number: string | null
          quantity: number
          recovery_fee_applicable: boolean
          replaced_by: string | null
          ride_id: string | null
          routing_channel: string
          service_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          structured_format: string | null
          structured_hash: string | null
          structured_path: string | null
          tax_legal_mention: string | null
          tax_regime: string | null
          tax_vat_number: string | null
          transmission_error: string | null
          transmission_status: string
          transmitted_at: string | null
          unit_price_ht: number | null
          updated_at: string
          vat_on_debits: boolean
          vat_rate: number
        }
        Insert: {
          amount_due?: number | null
          amount_ht?: number
          amount_paid?: number
          amount_ttc?: number
          auto_generated?: boolean
          client_id?: string | null
          created_at?: string
          credit_note_of?: string | null
          currency?: string
          customer_id?: string | null
          customer_kind?: string
          customer_snapshot?: Json | null
          description?: string | null
          discount_ht?: number
          document_hash?: string | null
          document_type?: string
          documents_generated_at?: string | null
          driver_id: string
          due_on?: string | null
          external_id?: string | null
          facturx_profile?: string | null
          facturx_spec_version?: string | null
          id?: string
          issued_at?: string | null
          issued_number_year?: number | null
          issued_on?: string
          issuer_snapshot?: Json | null
          late_penalty_applicable?: boolean
          legacy_pre_reform?: boolean
          number?: string | null
          operation_category?: string
          paid_at?: string | null
          passenger_name?: string | null
          payment_method?: string | null
          payment_terms?: string
          payment_terms_days?: number | null
          pdf_hash?: string | null
          pdf_path?: string | null
          po_number?: string | null
          quantity?: number
          recovery_fee_applicable?: boolean
          replaced_by?: string | null
          ride_id?: string | null
          routing_channel?: string
          service_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          structured_format?: string | null
          structured_hash?: string | null
          structured_path?: string | null
          tax_legal_mention?: string | null
          tax_regime?: string | null
          tax_vat_number?: string | null
          transmission_error?: string | null
          transmission_status?: string
          transmitted_at?: string | null
          unit_price_ht?: number | null
          updated_at?: string
          vat_on_debits?: boolean
          vat_rate?: number
        }
        Update: {
          amount_due?: number | null
          amount_ht?: number
          amount_paid?: number
          amount_ttc?: number
          auto_generated?: boolean
          client_id?: string | null
          created_at?: string
          credit_note_of?: string | null
          currency?: string
          customer_id?: string | null
          customer_kind?: string
          customer_snapshot?: Json | null
          description?: string | null
          discount_ht?: number
          document_hash?: string | null
          document_type?: string
          documents_generated_at?: string | null
          driver_id?: string
          due_on?: string | null
          external_id?: string | null
          facturx_profile?: string | null
          facturx_spec_version?: string | null
          id?: string
          issued_at?: string | null
          issued_number_year?: number | null
          issued_on?: string
          issuer_snapshot?: Json | null
          late_penalty_applicable?: boolean
          legacy_pre_reform?: boolean
          number?: string | null
          operation_category?: string
          paid_at?: string | null
          passenger_name?: string | null
          payment_method?: string | null
          payment_terms?: string
          payment_terms_days?: number | null
          pdf_hash?: string | null
          pdf_path?: string | null
          po_number?: string | null
          quantity?: number
          recovery_fee_applicable?: boolean
          replaced_by?: string | null
          ride_id?: string | null
          routing_channel?: string
          service_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          structured_format?: string | null
          structured_hash?: string | null
          structured_path?: string | null
          tax_legal_mention?: string | null
          tax_regime?: string | null
          tax_vat_number?: string | null
          transmission_error?: string | null
          transmission_status?: string
          transmitted_at?: string | null
          unit_price_ht?: number | null
          updated_at?: string
          vat_on_debits?: boolean
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_credit_note_of_fkey"
            columns: ["credit_note_of"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      live_locations: {
        Row: {
          consent: boolean
          id: string
          is_simulated: boolean
          lat: number
          lng: number
          ride_id: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consent?: boolean
          id?: string
          is_simulated?: boolean
          lat: number
          lng: number
          ride_id?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consent?: boolean
          id?: string
          is_simulated?: boolean
          lat?: number
          lng?: number
          ride_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_locations_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          driver_id: string
          id: string
          invoice_id: string
          method: string
          note: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          driver_id: string
          id?: string
          invoice_id: string
          method?: string
          note?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          invoice_id?: string
          method?: string
          note?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          location_enabled: boolean
          phone: string | null
          push_enabled: boolean
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          location_enabled?: boolean
          phone?: string | null
          push_enabled?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          location_enabled?: boolean
          phone?: string | null
          push_enabled?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          assigned_admin: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          reporter_id: string | null
          resolution: string | null
          ride_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_user_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          assigned_admin?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          reporter_id?: string | null
          resolution?: string | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          assigned_admin?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          reporter_id?: string | null
          resolution?: string | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_request_terms_acceptances: {
        Row: {
          accepted_at: string
          cancellation_version: string | null
          cgu_version: string
          cgv_version: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          cancellation_version?: string | null
          cgu_version: string
          cgv_version: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          cancellation_version?: string | null
          cgu_version?: string
          cgv_version?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_request_terms_acceptances_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          admin_cancellation_comment: string | null
          amount_ht: number | null
          amount_ttc: number | null
          cabin_luggage: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_role: string | null
          client_id: string
          comment: string | null
          created_at: string
          driver_id: string
          driver_message: string | null
          dropoff_address: string
          equipment_needs: string[]
          expired_at: string | null
          id: string
          idempotency_key: string | null
          is_immediate: boolean
          large_luggage: number
          luggage: number
          passengers: number
          payment_method: string | null
          payment_method_chosen_at: string | null
          payment_method_label: string | null
          pet_carrier: boolean
          pet_type: string | null
          pets_count: number
          pickup_address: string
          preferred_contact: string | null
          previous_status: string | null
          proposed_price: number | null
          proposed_time: string | null
          response_deadline: string | null
          ride_type: string
          round_trip: boolean
          scheduled_at: string
          special_needs: string | null
          status: Database["public"]["Enums"]["ride_status"]
          tax_computed_at: string | null
          tax_effective_from: string | null
          tax_legal_mention: string | null
          tax_legal_name: string | null
          tax_regime: string | null
          tax_vat_number: string | null
          tax_vat_rate: number | null
          trip_type: string | null
          updated_at: string
          vat_amount: number | null
        }
        Insert: {
          admin_cancellation_comment?: string | null
          amount_ht?: number | null
          amount_ttc?: number | null
          cabin_luggage?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          client_id: string
          comment?: string | null
          created_at?: string
          driver_id: string
          driver_message?: string | null
          dropoff_address: string
          equipment_needs?: string[]
          expired_at?: string | null
          id?: string
          idempotency_key?: string | null
          is_immediate?: boolean
          large_luggage?: number
          luggage?: number
          passengers?: number
          payment_method?: string | null
          payment_method_chosen_at?: string | null
          payment_method_label?: string | null
          pet_carrier?: boolean
          pet_type?: string | null
          pets_count?: number
          pickup_address: string
          preferred_contact?: string | null
          previous_status?: string | null
          proposed_price?: number | null
          proposed_time?: string | null
          response_deadline?: string | null
          ride_type?: string
          round_trip?: boolean
          scheduled_at: string
          special_needs?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          tax_computed_at?: string | null
          tax_effective_from?: string | null
          tax_legal_mention?: string | null
          tax_legal_name?: string | null
          tax_regime?: string | null
          tax_vat_number?: string | null
          tax_vat_rate?: number | null
          trip_type?: string | null
          updated_at?: string
          vat_amount?: number | null
        }
        Update: {
          admin_cancellation_comment?: string | null
          amount_ht?: number | null
          amount_ttc?: number | null
          cabin_luggage?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          client_id?: string
          comment?: string | null
          created_at?: string
          driver_id?: string
          driver_message?: string | null
          dropoff_address?: string
          equipment_needs?: string[]
          expired_at?: string | null
          id?: string
          idempotency_key?: string | null
          is_immediate?: boolean
          large_luggage?: number
          luggage?: number
          passengers?: number
          payment_method?: string | null
          payment_method_chosen_at?: string | null
          payment_method_label?: string | null
          pet_carrier?: boolean
          pet_type?: string | null
          pets_count?: number
          pickup_address?: string
          preferred_contact?: string | null
          previous_status?: string | null
          proposed_price?: number | null
          proposed_time?: string | null
          response_deadline?: string | null
          ride_type?: string
          round_trip?: boolean
          scheduled_at?: string
          special_needs?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          tax_computed_at?: string | null
          tax_effective_from?: string | null
          tax_legal_mention?: string | null
          tax_legal_name?: string | null
          tax_regime?: string | null
          tax_vat_number?: string | null
          tax_vat_rate?: number | null
          trip_type?: string | null
          updated_at?: string
          vat_amount?: number | null
        }
        Relationships: []
      }
      ride_reviews: {
        Row: {
          cleanliness_rating: number | null
          client_id: string
          comment: string | null
          created_at: string
          driver_id: string
          driving_rating: number | null
          id: string
          punctuality_rating: number | null
          rating: number
          ride_id: string
          service_rating: number | null
          status: string
          updated_at: string
        }
        Insert: {
          cleanliness_rating?: number | null
          client_id: string
          comment?: string | null
          created_at?: string
          driver_id: string
          driving_rating?: number | null
          id?: string
          punctuality_rating?: number | null
          rating: number
          ride_id: string
          service_rating?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          cleanliness_rating?: number | null
          client_id?: string
          comment?: string | null
          created_at?: string
          driver_id?: string
          driving_rating?: number | null
          id?: string
          punctuality_rating?: number | null
          rating?: number
          ride_id?: string
          service_rating?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_reviews_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: true
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          request_id: string | null
          ride_id: string | null
          status: Database["public"]["Enums"]["ride_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          request_id?: string | null
          ride_id?: string | null
          status: Database["public"]["Enums"]["ride_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          request_id?: string | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ride_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_status_history_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          admin_cancellation_comment: string | null
          amount_ht: number | null
          amount_ttc: number | null
          cancel_decided_at: string | null
          cancel_decided_by: string | null
          cancel_request_reason: string | null
          cancel_request_status: string | null
          cancel_requested_at: string | null
          cancel_requested_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_role: string | null
          client_id: string | null
          client_label: string | null
          completed_at: string | null
          completion_note: string | null
          created_at: string
          driver_id: string
          dropoff_address: string
          id: string
          is_block: boolean
          mileage_km: number | null
          notes: string | null
          passengers: number
          payment_method: string | null
          payment_method_label: string | null
          pickup_address: string
          previous_status: string | null
          price: number | null
          request_id: string | null
          ride_type: string
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          tax_computed_at: string | null
          tax_effective_from: string | null
          tax_legal_mention: string | null
          tax_legal_name: string | null
          tax_regime: string | null
          tax_vat_number: string | null
          tax_vat_rate: number | null
          updated_at: string
          vat_amount: number | null
        }
        Insert: {
          admin_cancellation_comment?: string | null
          amount_ht?: number | null
          amount_ttc?: number | null
          cancel_decided_at?: string | null
          cancel_decided_by?: string | null
          cancel_request_reason?: string | null
          cancel_request_status?: string | null
          cancel_requested_at?: string | null
          cancel_requested_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          client_id?: string | null
          client_label?: string | null
          completed_at?: string | null
          completion_note?: string | null
          created_at?: string
          driver_id: string
          dropoff_address: string
          id?: string
          is_block?: boolean
          mileage_km?: number | null
          notes?: string | null
          passengers?: number
          payment_method?: string | null
          payment_method_label?: string | null
          pickup_address: string
          previous_status?: string | null
          price?: number | null
          request_id?: string | null
          ride_type?: string
          scheduled_at: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          tax_computed_at?: string | null
          tax_effective_from?: string | null
          tax_legal_mention?: string | null
          tax_legal_name?: string | null
          tax_regime?: string | null
          tax_vat_number?: string | null
          tax_vat_rate?: number | null
          updated_at?: string
          vat_amount?: number | null
        }
        Update: {
          admin_cancellation_comment?: string | null
          amount_ht?: number | null
          amount_ttc?: number | null
          cancel_decided_at?: string | null
          cancel_decided_by?: string | null
          cancel_request_reason?: string | null
          cancel_request_status?: string | null
          cancel_requested_at?: string | null
          cancel_requested_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          client_id?: string | null
          client_label?: string | null
          completed_at?: string | null
          completion_note?: string | null
          created_at?: string
          driver_id?: string
          dropoff_address?: string
          id?: string
          is_block?: boolean
          mileage_km?: number | null
          notes?: string | null
          passengers?: number
          payment_method?: string | null
          payment_method_label?: string | null
          pickup_address?: string
          previous_status?: string | null
          price?: number | null
          request_id?: string | null
          ride_type?: string
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          tax_computed_at?: string | null
          tax_effective_from?: string | null
          tax_legal_mention?: string | null
          tax_legal_name?: string | null
          tax_regime?: string | null
          tax_vat_number?: string | null
          tax_vat_rate?: number | null
          updated_at?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          accessible: boolean
          air_conditioning: boolean
          booster_seat: boolean
          brand: string | null
          cabin_luggage_capacity: number | null
          card_payment: boolean
          category: string | null
          chargers: boolean
          child_seat: boolean
          color: string | null
          created_at: string
          driver_id: string
          equipments: string[]
          id: string
          inspection_expires_at: string | null
          insurance_expires_at: string | null
          insurance_provider: string | null
          is_primary: boolean
          large_luggage_capacity: number | null
          large_trunk: boolean
          luggage_capacity: number
          luggage_help: boolean
          max_passengers: number
          mileage: number | null
          model: string | null
          next_service_date: string | null
          pets_allowed: boolean
          pets_carrier_required: boolean
          pets_conditions: string | null
          pets_max: number | null
          pets_policy: string
          photo_interior_url: string | null
          photo_url: string | null
          plate: string | null
          quiet_ride: boolean
          stroller_space: boolean
          updated_at: string
          water: boolean
          year: number | null
        }
        Insert: {
          accessible?: boolean
          air_conditioning?: boolean
          booster_seat?: boolean
          brand?: string | null
          cabin_luggage_capacity?: number | null
          card_payment?: boolean
          category?: string | null
          chargers?: boolean
          child_seat?: boolean
          color?: string | null
          created_at?: string
          driver_id: string
          equipments?: string[]
          id?: string
          inspection_expires_at?: string | null
          insurance_expires_at?: string | null
          insurance_provider?: string | null
          is_primary?: boolean
          large_luggage_capacity?: number | null
          large_trunk?: boolean
          luggage_capacity?: number
          luggage_help?: boolean
          max_passengers?: number
          mileage?: number | null
          model?: string | null
          next_service_date?: string | null
          pets_allowed?: boolean
          pets_carrier_required?: boolean
          pets_conditions?: string | null
          pets_max?: number | null
          pets_policy?: string
          photo_interior_url?: string | null
          photo_url?: string | null
          plate?: string | null
          quiet_ride?: boolean
          stroller_space?: boolean
          updated_at?: string
          water?: boolean
          year?: number | null
        }
        Update: {
          accessible?: boolean
          air_conditioning?: boolean
          booster_seat?: boolean
          brand?: string | null
          cabin_luggage_capacity?: number | null
          card_payment?: boolean
          category?: string | null
          chargers?: boolean
          child_seat?: boolean
          color?: string | null
          created_at?: string
          driver_id?: string
          equipments?: string[]
          id?: string
          inspection_expires_at?: string | null
          insurance_expires_at?: string | null
          insurance_provider?: string | null
          is_primary?: boolean
          large_luggage_capacity?: number | null
          large_trunk?: boolean
          luggage_capacity?: number
          luggage_help?: boolean
          max_passengers?: number
          mileage?: number | null
          model?: string | null
          next_service_date?: string | null
          pets_allowed?: boolean
          pets_carrier_required?: boolean
          pets_conditions?: string | null
          pets_max?: number | null
          pets_policy?: string
          photo_interior_url?: string | null
          photo_url?: string | null
          plate?: string | null
          quiet_ride?: boolean
          stroller_space?: boolean
          updated_at?: string
          water?: boolean
          year?: number | null
        }
        Relationships: []
      }
      verification_documents: {
        Row: {
          created_at: string
          doc_type: string
          driver_id: string
          expires_at: string | null
          file_path: string | null
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          driver_id: string
          expires_at?: string | null
          file_path?: string | null
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          driver_id?: string
          expires_at?: string | null
          file_path?: string | null
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cancel_ride: {
        Args: { _admin_comment?: string; _reason: string; _ride: string }
        Returns: Json
      }
      admin_decide_driver: {
        Args: { _decision: string; _driver: string; _reason?: string }
        Returns: Json
      }
      admin_review_document: {
        Args: {
          _decision: Database["public"]["Enums"]["document_status"]
          _document: string
          _note?: string
        }
        Returns: undefined
      }
      admin_review_section: {
        Args: {
          _decision: string
          _driver: string
          _note?: string
          _section: string
        }
        Returns: Json
      }
      admin_validate_section: {
        Args: { _driver: string; _note?: string; _section: string }
        Returns: Json
      }
      cancel_client_ride_request: {
        Args: { _request: string }
        Returns: Database["public"]["Enums"]["ride_status"]
      }
      check_ride_compatibility: {
        Args: { _driver: string; _req: Json }
        Returns: Json
      }
      compute_ride_quote: {
        Args: {
          _at?: string
          _distance_km: number
          _driver: string
          _round_trip?: boolean
        }
        Returns: {
          amount_ht: number
          amount_ttc: number
          base_ht: number
          effective_from: string
          legal_mention: string
          minimum_ht: number
          price_per_km_ht: number
          rate_label: string
          regime: string
          rounding_ht: number
          tariff_confirmed: boolean
          tax_configured: boolean
          vat_amount: number
          vat_number: string
          vat_rate: number
        }[]
      }
      create_client_ride_request:
        | {
            Args: {
              _cancellation_version?: string
              _cgu_version?: string
              _cgv_version?: string
              _comment: string
              _driver: string
              _dropoff: string
              _idempotency_key: string
              _immediate: boolean
              _luggage: number
              _passengers: number
              _pickup: string
              _proposed_price: number
              _round_trip: boolean
              _scheduled_at: string
              _special_needs: string
              _trip_type: string
            }
            Returns: {
              blocked: boolean
              blocking_request_id: string
              request_id: string
              reused: boolean
            }[]
          }
        | {
            Args: {
              _cancellation_version?: string
              _cgu_version?: string
              _cgv_version?: string
              _comment: string
              _distance_km?: number
              _driver: string
              _dropoff: string
              _idempotency_key: string
              _immediate: boolean
              _luggage: number
              _passengers: number
              _pickup: string
              _proposed_price: number
              _round_trip: boolean
              _scheduled_at: string
              _special_needs: string
              _trip_type: string
            }
            Returns: {
              blocked: boolean
              blocking_request_id: string
              request_id: string
              reused: boolean
            }[]
          }
        | {
            Args: {
              _cancellation_version: string
              _cgu_version: string
              _cgv_version: string
              _comment: string
              _distance_km: number
              _driver: string
              _dropoff: string
              _idempotency_key: string
              _immediate: boolean
              _luggage: number
              _passengers: number
              _pickup: string
              _proposed_price: number
              _requirements: Json
              _round_trip: boolean
              _scheduled_at: string
              _special_needs: string
              _trip_type: string
            }
            Returns: {
              blocked: boolean
              blocking_request_id: string
              request_id: string
              reused: boolean
            }[]
          }
        | {
            Args: {
              _cancellation_version: string
              _cgu_version: string
              _cgv_version: string
              _comment: string
              _distance_km: number
              _driver: string
              _dropoff: string
              _idempotency_key: string
              _immediate: boolean
              _luggage: number
              _passengers: number
              _payment_method: string
              _pickup: string
              _proposed_price: number
              _requirements: Json
              _round_trip: boolean
              _scheduled_at: string
              _special_needs: string
              _trip_type: string
            }
            Returns: {
              blocked: boolean
              blocking_request_id: string
              request_id: string
              reused: boolean
            }[]
          }
      create_credit_note: {
        Args: { _amount_ttc?: number; _invoice_id: string; _reason: string }
        Returns: {
          amount_due: number | null
          amount_ht: number
          amount_paid: number
          amount_ttc: number
          auto_generated: boolean
          client_id: string | null
          created_at: string
          credit_note_of: string | null
          currency: string
          customer_id: string | null
          customer_kind: string
          customer_snapshot: Json | null
          description: string | null
          discount_ht: number
          document_hash: string | null
          document_type: string
          documents_generated_at: string | null
          driver_id: string
          due_on: string | null
          external_id: string | null
          facturx_profile: string | null
          facturx_spec_version: string | null
          id: string
          issued_at: string | null
          issued_number_year: number | null
          issued_on: string
          issuer_snapshot: Json | null
          late_penalty_applicable: boolean
          legacy_pre_reform: boolean
          number: string | null
          operation_category: string
          paid_at: string | null
          passenger_name: string | null
          payment_method: string | null
          payment_terms: string
          payment_terms_days: number | null
          pdf_hash: string | null
          pdf_path: string | null
          po_number: string | null
          quantity: number
          recovery_fee_applicable: boolean
          replaced_by: string | null
          ride_id: string | null
          routing_channel: string
          service_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          structured_format: string | null
          structured_hash: string | null
          structured_path: string | null
          tax_legal_mention: string | null
          tax_regime: string | null
          tax_vat_number: string | null
          transmission_error: string | null
          transmission_status: string
          transmitted_at: string | null
          unit_price_ht: number | null
          updated_at: string
          vat_on_debits: boolean
          vat_rate: number
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      driver_available_between: {
        Args: { _driver: string; _end: string; _start: string }
        Returns: boolean
      }
      driver_day_window: {
        Args: { _day: string; _driver: string }
        Returns: {
          available: boolean
          defined: boolean
          end_time: string
          start_time: string
        }[]
      }
      driver_dossier_state: { Args: { _driver: string }; Returns: Json }
      driver_payment_methods: { Args: { _driver: string }; Returns: string[] }
      driver_tax_at: {
        Args: { _at?: string; _driver: string }
        Returns: {
          configured: boolean
          effective_from: string
          legal_mention: string
          rate_label: string
          regime: string
          vat_number: string
          vat_rate: number
        }[]
      }
      expire_stale_immediate_requests: {
        Args: { _client?: string }
        Returns: number
      }
      get_blocking_immediate_request: {
        Args: never
        Returns: {
          can_cancel: boolean
          created_at: string
          driver_first_name: string
          driver_id: string
          kind: string
          request_id: string
          response_deadline: string
          ride_id: string
          status: Database["public"]["Enums"]["ride_status"]
        }[]
      }
      get_connected_driver_profiles: {
        Args: never
        Returns: {
          accepting_requests: boolean
          airports: string[]
          availability: string[]
          bio: string
          booking_notice: string
          business_name: string
          city: string
          created_at: string
          facebook_url: string
          instagram_url: string
          languages: string[]
          linkedin_url: string
          long_distance: boolean
          on_duty: boolean
          page_published: boolean
          public_intro: string
          public_phone: string
          service_areas: string[]
          services: string[]
          slug: string
          stations: string[]
          tiktok_url: string
          user_id: string
          whatsapp_number: string
          zone: string
        }[]
      }
      get_driver_booking_theme: {
        Args: { _driver?: string; _slug?: string }
        Returns: {
          booking_theme: string
          brand_cover_path: string
          brand_display_name: string
          brand_logo_path: string
          brand_welcome_message: string
          slug: string
          user_id: string
        }[]
      }
      get_driver_vehicle_capacity: {
        Args: { _driver: string }
        Returns: {
          accessible: boolean
          booster_seat: boolean
          brand: string
          cabin_luggage_capacity: number
          child_seat: boolean
          large_luggage_capacity: number
          large_trunk: boolean
          luggage_capacity: number
          max_passengers: number
          model: string
          pets_carrier_required: boolean
          pets_conditions: string
          pets_max: number
          pets_policy: string
          stroller_space: boolean
          vehicle_id: string
        }[]
      }
      get_invoice_issuer: {
        Args: { _driver: string }
        Returns: {
          billing_legal_info: string
          business_name: string
          email: string
          full_name: string
          professional_address: string
          public_phone: string
          siret: string
          vat_applicable: boolean
          vtc_card_number: string
        }[]
      }
      get_public_driver_page: {
        Args: { _slug: string }
        Returns: {
          accepting_requests: boolean
          accessible: boolean
          air_conditioning: boolean
          airports: string[]
          availability: string[]
          avatar_url: string
          bio: string
          booking_notice: string
          booster_seat: boolean
          business_name: string
          cabin_luggage_capacity: number
          card_payment: boolean
          chargers: boolean
          child_seat: boolean
          city: string
          company_verified: boolean
          facebook_url: string
          full_name: string
          instagram_url: string
          languages: string[]
          large_luggage_capacity: number
          large_trunk: boolean
          linkedin_url: string
          long_distance: boolean
          luggage_capacity: number
          luggage_help: boolean
          max_passengers: number
          member_since: string
          pets_allowed: boolean
          pets_carrier_required: boolean
          pets_conditions: string
          pets_max: number
          pets_policy: string
          public_intro: string
          public_phone: string
          quiet_ride: boolean
          service_areas: string[]
          services: string[]
          slug: string
          stations: string[]
          stroller_space: boolean
          tiktok_url: string
          user_id: string
          vehicle_brand: string
          vehicle_category: string
          vehicle_color: string
          vehicle_interior_photo_url: string
          vehicle_model: string
          vehicle_photo_url: string
          vehicle_year: number
          verified_docs: string[]
          water: boolean
          whatsapp_number: string
          zone: string
        }[]
      }
      get_public_driver_rating: {
        Args: { _slug: string }
        Returns: {
          rating_avg: number
          rating_count: number
          stars1: number
          stars2: number
          stars3: number
          stars4: number
          stars5: number
        }[]
      }
      get_public_driver_reviews: {
        Args: { _limit?: number; _slug: string }
        Returns: {
          author_avatar: string
          author_name: string
          comment: string
          created_at: string
          id: string
          rating: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_connected: {
        Args: { _client: string; _driver: string }
        Returns: boolean
      }
      is_valid_siren: { Args: { _siren: string }; Returns: boolean }
      is_verified_driver: { Args: { _driver: string }; Returns: boolean }
      issue_invoice: {
        Args: { _invoice_id: string }
        Returns: {
          amount_due: number | null
          amount_ht: number
          amount_paid: number
          amount_ttc: number
          auto_generated: boolean
          client_id: string | null
          created_at: string
          credit_note_of: string | null
          currency: string
          customer_id: string | null
          customer_kind: string
          customer_snapshot: Json | null
          description: string | null
          discount_ht: number
          document_hash: string | null
          document_type: string
          documents_generated_at: string | null
          driver_id: string
          due_on: string | null
          external_id: string | null
          facturx_profile: string | null
          facturx_spec_version: string | null
          id: string
          issued_at: string | null
          issued_number_year: number | null
          issued_on: string
          issuer_snapshot: Json | null
          late_penalty_applicable: boolean
          legacy_pre_reform: boolean
          number: string | null
          operation_category: string
          paid_at: string | null
          passenger_name: string | null
          payment_method: string | null
          payment_terms: string
          payment_terms_days: number | null
          pdf_hash: string | null
          pdf_path: string | null
          po_number: string | null
          quantity: number
          recovery_fee_applicable: boolean
          replaced_by: string | null
          ride_id: string | null
          routing_channel: string
          service_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          structured_format: string | null
          structured_hash: string | null
          structured_path: string | null
          tax_legal_mention: string | null
          tax_regime: string | null
          tax_vat_number: string | null
          transmission_error: string | null
          transmission_status: string
          transmitted_at: string | null
          unit_price_ht: number | null
          updated_at: string
          vat_on_debits: boolean
          vat_rate: number
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_invoice_number: {
        Args: { _driver: string; _type?: string; _year: number }
        Returns: string
      }
      notify_counterparty: {
        Args: { _kind: string; _recipient: string }
        Returns: undefined
      }
      payment_method_label: { Args: { _key: string }; Returns: string }
      process_document_expiry: { Args: never; Returns: number }
      queue_ereporting: {
        Args: { _invoice_id: string; _kind: string; _payload?: Json }
        Returns: {
          ack_code: string | null
          ack_message: string | null
          created_at: string
          currency: string
          driver_id: string
          external_id: string | null
          id: string
          invoice_id: string | null
          kind: string
          pa_provider: string | null
          payload: Json | null
          period_end: string | null
          period_start: string | null
          status: string
          total_ht: number
          total_ttc: number
          total_vat: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ereporting_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_invoice_documents: {
        Args: { _docs: Json; _invoice_id: string }
        Returns: {
          byte_size: number | null
          content_type: string | null
          driver_id: string
          generated_at: string
          id: string
          invoice_id: string
          kind: string
          path: string
          profile: string | null
          sha256: string
          spec_version: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "invoice_documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      record_invoice_payment: {
        Args: {
          _amount: number
          _invoice_id: string
          _method: string
          _note?: string
          _paid_at?: string
        }
        Returns: {
          amount_due: number | null
          amount_ht: number
          amount_paid: number
          amount_ttc: number
          auto_generated: boolean
          client_id: string | null
          created_at: string
          credit_note_of: string | null
          currency: string
          customer_id: string | null
          customer_kind: string
          customer_snapshot: Json | null
          description: string | null
          discount_ht: number
          document_hash: string | null
          document_type: string
          documents_generated_at: string | null
          driver_id: string
          due_on: string | null
          external_id: string | null
          facturx_profile: string | null
          facturx_spec_version: string | null
          id: string
          issued_at: string | null
          issued_number_year: number | null
          issued_on: string
          issuer_snapshot: Json | null
          late_penalty_applicable: boolean
          legacy_pre_reform: boolean
          number: string | null
          operation_category: string
          paid_at: string | null
          passenger_name: string | null
          payment_method: string | null
          payment_terms: string
          payment_terms_days: number | null
          pdf_hash: string | null
          pdf_path: string | null
          po_number: string | null
          quantity: number
          recovery_fee_applicable: boolean
          replaced_by: string | null
          ride_id: string | null
          routing_channel: string
          service_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          structured_format: string | null
          structured_hash: string | null
          structured_path: string | null
          tax_legal_mention: string | null
          tax_regime: string | null
          tax_vat_number: string | null
          transmission_error: string | null
          transmission_status: string
          transmitted_at: string | null
          unit_price_ht: number | null
          updated_at: string
          vat_on_debits: boolean
          vat_rate: number
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_invoice_transmission: {
        Args: {
          _ack_code?: string
          _ack_message?: string
          _channel: string
          _detail?: Json
          _external_id?: string
          _invoice_id: string
          _pa_provider?: string
          _status: string
        }
        Returns: {
          ack_code: string | null
          ack_message: string | null
          channel: string
          detail: Json | null
          direction: string
          driver_id: string
          external_id: string | null
          id: string
          invoice_id: string
          occurred_at: string
          pa_provider: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "invoice_transmissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_driver_dossier: { Args: never; Returns: Json }
      track_driver_event: {
        Args: { _event: string; _slug: string }
        Returns: undefined
      }
      track_driver_page_view: { Args: { _slug: string }; Returns: undefined }
    }
    Enums: {
      account_status:
        | "active"
        | "email_unverified"
        | "phone_unverified"
        | "restricted"
        | "suspended"
        | "deleted"
      app_role: "client" | "driver" | "admin" | "superadmin"
      crm_status: "new" | "active" | "regular" | "inactive"
      document_status: "pending" | "approved" | "rejected" | "expired"
      invoice_status:
        | "draft"
        | "sent"
        | "paid"
        | "cancelled"
        | "issued"
        | "overdue"
        | "to_review"
        | "ready"
        | "transmitted"
        | "received"
        | "rejected"
        | "partially_paid"
        | "credited"
      report_status: "new" | "in_progress" | "waiting" | "resolved" | "closed"
      ride_status:
        | "new"
        | "reviewing"
        | "proposal_sent"
        | "awaiting_client"
        | "confirmed"
        | "driver_enroute"
        | "driver_arrived"
        | "client_onboard"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "refused"
        | "expired"
      verification_status:
        | "incomplete"
        | "pending"
        | "verified"
        | "changes_requested"
        | "rejected"
        | "suspended"
        | "under_review"
        | "expired_documents"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: [
        "active",
        "email_unverified",
        "phone_unverified",
        "restricted",
        "suspended",
        "deleted",
      ],
      app_role: ["client", "driver", "admin", "superadmin"],
      crm_status: ["new", "active", "regular", "inactive"],
      document_status: ["pending", "approved", "rejected", "expired"],
      invoice_status: [
        "draft",
        "sent",
        "paid",
        "cancelled",
        "issued",
        "overdue",
        "to_review",
        "ready",
        "transmitted",
        "received",
        "rejected",
        "partially_paid",
        "credited",
      ],
      report_status: ["new", "in_progress", "waiting", "resolved", "closed"],
      ride_status: [
        "new",
        "reviewing",
        "proposal_sent",
        "awaiting_client",
        "confirmed",
        "driver_enroute",
        "driver_arrived",
        "client_onboard",
        "in_progress",
        "completed",
        "cancelled",
        "refused",
        "expired",
      ],
      verification_status: [
        "incomplete",
        "pending",
        "verified",
        "changes_requested",
        "rejected",
        "suspended",
        "under_review",
        "expired_documents",
      ],
    },
  },
} as const
