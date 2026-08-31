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
    PostgrestVersion: "14.5"
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
          source: string | null
          visitor_key: string | null
        }
        Insert: {
          city?: string | null
          client_id?: string | null
          created_at?: string
          driver_id?: string | null
          event: string
          id?: string
          metadata?: Json | null
          source?: string | null
          visitor_key?: string | null
        }
        Update: {
          city?: string | null
          client_id?: string | null
          created_at?: string
          driver_id?: string | null
          event?: string
          id?: string
          metadata?: Json | null
          source?: string | null
          visitor_key?: string | null
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
      driver_plan_changes: {
        Row: {
          changed_by: string | null
          created_at: string
          driver_id: string
          expires_at: string | null
          id: string
          new_billing_status: string | null
          new_plan: string
          old_billing_status: string | null
          old_plan: string
          reason: string | null
          source: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          driver_id: string
          expires_at?: string | null
          id?: string
          new_billing_status?: string | null
          new_plan: string
          old_billing_status?: string | null
          old_plan: string
          reason?: string | null
          source?: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          driver_id?: string
          expires_at?: string | null
          id?: string
          new_billing_status?: string | null
          new_plan?: string
          old_billing_status?: string | null
          old_plan?: string
          reason?: string | null
          source?: string
        }
        Relationships: []
      }
      driver_profile_views: {
        Row: {
          client_id: string
          created_at: string
          driver_id: string
          id: string
          updated_at: string
          viewed_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          driver_id: string
          id?: string
          updated_at?: string
          viewed_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          updated_at?: string
          viewed_at?: string
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
          billing_status: string
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
          driver_kind: string
          experience_years: number | null
          expiry_notified_at: string | null
          facebook_url: string | null
          gender: string | null
          instagram_url: string | null
          languages: string[]
          linkedin_url: string | null
          long_distance: boolean
          on_duty: boolean
          page_published: boolean
          payment_methods: string[]
          plan: string
          plan_expires_at: string | null
          plan_reason: string | null
          plan_renews_at: string | null
          plan_started_at: string | null
          pro_tariff_snapshot: Json | null
          professional_address: string | null
          public_intro: string | null
          public_phone: string | null
          rejection_reason: string | null
          service_areas: string[]
          service_departments: string[]
          services: string[]
          show_public_phone: boolean
          show_whatsapp: boolean
          siret: string | null
          slug: string
          stations: string[]
          submitted_at: string | null
          suspended_at: string | null
          suspension_reason: string | null
          taxi_license_number: string | null
          theme_updated_at: string | null
          tiktok_url: string | null
          updated_at: string
          user_id: string
          vat_applicable: boolean
          verification_status: Database["public"]["Enums"]["verification_status"]
          vtc_card_number: string | null
          website_url: string | null
          whatsapp_number: string | null
          woman_for_woman: boolean
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
          billing_status?: string
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
          driver_kind?: string
          experience_years?: number | null
          expiry_notified_at?: string | null
          facebook_url?: string | null
          gender?: string | null
          instagram_url?: string | null
          languages?: string[]
          linkedin_url?: string | null
          long_distance?: boolean
          on_duty?: boolean
          page_published?: boolean
          payment_methods?: string[]
          plan?: string
          plan_expires_at?: string | null
          plan_reason?: string | null
          plan_renews_at?: string | null
          plan_started_at?: string | null
          pro_tariff_snapshot?: Json | null
          professional_address?: string | null
          public_intro?: string | null
          public_phone?: string | null
          rejection_reason?: string | null
          service_areas?: string[]
          service_departments?: string[]
          services?: string[]
          show_public_phone?: boolean
          show_whatsapp?: boolean
          siret?: string | null
          slug: string
          stations?: string[]
          submitted_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          taxi_license_number?: string | null
          theme_updated_at?: string | null
          tiktok_url?: string | null
          updated_at?: string
          user_id: string
          vat_applicable?: boolean
          verification_status?: Database["public"]["Enums"]["verification_status"]
          vtc_card_number?: string | null
          website_url?: string | null
          whatsapp_number?: string | null
          woman_for_woman?: boolean
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
          billing_status?: string
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
          driver_kind?: string
          experience_years?: number | null
          expiry_notified_at?: string | null
          facebook_url?: string | null
          gender?: string | null
          instagram_url?: string | null
          languages?: string[]
          linkedin_url?: string | null
          long_distance?: boolean
          on_duty?: boolean
          page_published?: boolean
          payment_methods?: string[]
          plan?: string
          plan_expires_at?: string | null
          plan_reason?: string | null
          plan_renews_at?: string | null
          plan_started_at?: string | null
          pro_tariff_snapshot?: Json | null
          professional_address?: string | null
          public_intro?: string | null
          public_phone?: string | null
          rejection_reason?: string | null
          service_areas?: string[]
          service_departments?: string[]
          services?: string[]
          show_public_phone?: boolean
          show_whatsapp?: boolean
          siret?: string | null
          slug?: string
          stations?: string[]
          submitted_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          taxi_license_number?: string | null
          theme_updated_at?: string | null
          tiktok_url?: string | null
          updated_at?: string
          user_id?: string
          vat_applicable?: boolean
          verification_status?: Database["public"]["Enums"]["verification_status"]
          vtc_card_number?: string | null
          website_url?: string | null
          whatsapp_number?: string | null
          woman_for_woman?: boolean
          women_for_women_eligible?: boolean
          women_for_women_verified_at?: string | null
          women_for_women_verified_by?: string | null
          zone?: string | null
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
          night_enabled: boolean
          night_end: string
          night_pct: number
          night_start: string
          pickup_pct: number
          price_per_km_ht: number
          updated_at: string
        }
        Insert: {
          basis?: string
          basis_confirmed_at?: string | null
          created_at?: string
          driver_id: string
          minimum_ht?: number
          night_enabled?: boolean
          night_end?: string
          night_pct?: number
          night_start?: string
          pickup_pct?: number
          price_per_km_ht?: number
          updated_at?: string
        }
        Update: {
          basis?: string
          basis_confirmed_at?: string | null
          created_at?: string
          driver_id?: string
          minimum_ht?: number
          night_enabled?: boolean
          night_end?: string
          night_pct?: number
          night_start?: string
          pickup_pct?: number
          price_per_km_ht?: number
          updated_at?: string
        }
        Relationships: []
      }
      geo_place_cache: {
        Row: {
          created_at: string
          label: string | null
          lat: number | null
          lng: number | null
          name_norm: string
          postcode: string | null
          resolved: boolean
        }
        Insert: {
          created_at?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          name_norm: string
          postcode?: string | null
          resolved?: boolean
        }
        Update: {
          created_at?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          name_norm?: string
          postcode?: string | null
          resolved?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          push: boolean
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
          push?: boolean
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
          push?: boolean
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          gender: string | null
          gender_correction_used: boolean
          id: string
          location_enabled: boolean
          notification_prefs: Json
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
          gender?: string | null
          gender_correction_used?: boolean
          id: string
          location_enabled?: boolean
          notification_prefs?: Json
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
          gender?: string | null
          gender_correction_used?: boolean
          id?: string
          location_enabled?: boolean
          notification_prefs?: Json
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
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      siren_verifications: {
        Row: {
          checked_at: string
          confirmed_by_driver: boolean
          created_at: string
          customer_id: string | null
          driver_id: string
          id: string
          name_match: string | null
          registry_legal_name: string | null
          result: string
          siren: string
          source: string
          submitted_legal_name: string | null
        }
        Insert: {
          checked_at?: string
          confirmed_by_driver?: boolean
          created_at?: string
          customer_id?: string | null
          driver_id: string
          id?: string
          name_match?: string | null
          registry_legal_name?: string | null
          result: string
          siren: string
          source: string
          submitted_legal_name?: string | null
        }
        Update: {
          checked_at?: string
          confirmed_by_driver?: boolean
          created_at?: string
          customer_id?: string | null
          driver_id?: string
          id?: string
          name_match?: string | null
          registry_legal_name?: string | null
          result?: string
          siren?: string
          source?: string
          submitted_legal_name?: string | null
        }
        Relationships: []
      }
      top10_drivers: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          rank_position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          rank_position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          rank_position?: number
          updated_at?: string
        }
        Relationships: []
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
          photo_access_url: string | null
          photo_child_seat_url: string | null
          photo_front_url: string | null
          photo_interior_url: string | null
          photo_pet_url: string | null
          photo_side_url: string | null
          photo_trunk_url: string | null
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
          photo_access_url?: string | null
          photo_child_seat_url?: string | null
          photo_front_url?: string | null
          photo_interior_url?: string | null
          photo_pet_url?: string | null
          photo_side_url?: string | null
          photo_trunk_url?: string | null
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
          photo_access_url?: string | null
          photo_child_seat_url?: string | null
          photo_front_url?: string | null
          photo_interior_url?: string | null
          photo_pet_url?: string | null
          photo_side_url?: string | null
          photo_trunk_url?: string | null
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
      admin_decide_driver: {
        Args: { _decision: string; _driver: string; _reason?: string }
        Returns: Json
      }
      admin_log_vehicle_photo: {
        Args: {
          _action: string
          _driver_id: string
          _field: string
          _new_path: string
          _old_path: string
        }
        Returns: undefined
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
      admin_set_driver_plan: {
        Args: {
          _billing_status?: string
          _driver: string
          _expires_at?: string
          _plan: string
          _reason?: string
          _restore_tariffs?: boolean
        }
        Returns: Json
      }
      admin_validate_section: {
        Args: { _driver: string; _note?: string; _section: string }
        Returns: Json
      }
      can_read_driver_media: {
        Args: { _folder: string; _viewer: string }
        Returns: boolean
      }
      dossier_blocking_items: { Args: { _state: Json }; Returns: string }
      driver_dossier_state: { Args: { _driver: string }; Returns: Json }
      driver_page_access: { Args: { _slug: string }; Returns: string }
      driver_plan: { Args: { _driver: string }; Returns: string }
      expire_temporary_pro_plans: { Args: never; Returns: number }
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
          woman_for_woman: boolean
          zone: string
        }[]
      }
      get_connected_profiles: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          phone: string
        }[]
      }
      get_discover_drivers: {
        Args: { _limit?: number }
        Returns: {
          accepting_requests: boolean
          airports: string[]
          avatar_url: string
          bio: string
          city: string
          display_name: string
          full_name: string
          languages: string[]
          long_distance: boolean
          max_passengers: number
          member_since: string
          on_duty: boolean
          public_intro: string
          rating_avg: number
          rating_count: number
          services: string[]
          slug: string
          user_id: string
          vehicle_brand: string
          vehicle_category: string
          vehicle_interior_photo_url: string
          vehicle_model: string
          vehicle_photo_url: string
          woman_for_woman: boolean
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
      get_driver_qr_stats: { Args: { _days?: number }; Returns: Json }
      get_driver_themes: {
        Args: { _ids: string[] }
        Returns: {
          booking_theme: string
          user_id: string
        }[]
      }
      get_driver_visibility_stats: {
        Args: { _days?: number }
        Returns: {
          contact_clicks: number
          network_adds: number
          profile_views: number
          search_appearances: number
        }[]
      }
      get_local_drivers: {
        Args: { _limit?: number; _sector?: string }
        Returns: {
          accepting_requests: boolean
          airports: string[]
          avatar_url: string
          bio: string
          city: string
          display_name: string
          long_distance: boolean
          max_passengers: number
          member_since: string
          on_duty: boolean
          price_per_km: number
          public_intro: string
          quality_score: number
          rank_position: number
          rating_avg: number
          rating_count: number
          sector_match: boolean
          service_areas: string[]
          service_departments: string[]
          services: string[]
          slug: string
          user_id: string
          vehicle_brand: string
          vehicle_category: string
          vehicle_interior_photo_url: string
          vehicle_model: string
          vehicle_photo_url: string
          woman_for_woman: boolean
          zone: string
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
          vehicle_front_photo_url: string
          vehicle_interior_photo_url: string
          vehicle_model: string
          vehicle_photo_url: string
          vehicle_side_photo_url: string
          vehicle_year: number
          verified_docs: string[]
          water: boolean
          whatsapp_number: string
          woman_for_woman: boolean
          zone: string
        }[]
      }
      get_public_driver_pricing: {
        Args: { _slug: string }
        Returns: {
          basis: string
          driver_id: string
          minimum: number
          pickup_pct: number
          price_per_km: number
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
      is_public_driver_folder: { Args: { _folder: string }; Returns: boolean }
      is_service_role_call: { Args: never; Returns: boolean }
      is_valid_siren: { Args: { _siren: string }; Returns: boolean }
      is_verified_driver: { Args: { _driver: string }; Returns: boolean }
      notify_counterparty: {
        Args: { _kind: string; _recipient: string }
        Returns: undefined
      }
      process_document_expiry: { Args: never; Returns: number }
      relink_department_code: { Args: { _value: string }; Returns: string }
      relink_normalize: { Args: { _t: string }; Returns: string }
      search_public_drivers: {
        Args: {
          _category?: string
          _department?: string
          _language?: string
          _limit?: number
          _min_passengers?: number
          _offset?: number
          _q?: string
          _service?: string
        }
        Returns: {
          avatar_url: string
          city: string
          display_name: string
          experience_years: number
          full_name: string
          languages: string[]
          luggage_capacity: number
          max_passengers: number
          member_since: string
          public_intro: string
          service_areas: string[]
          service_departments: string[]
          services: string[]
          slug: string
          user_id: string
          vehicle_brand: string
          vehicle_category: string
          vehicle_model: string
          vehicle_photo_url: string
          woman_for_woman: boolean
          zone: string
        }[]
      }
      set_my_gender: { Args: { _gender: string }; Returns: Json }
      submit_driver_dossier: { Args: never; Returns: Json }
      track_driver_event: {
        Args: { _event: string; _slug: string }
        Returns: undefined
      }
      track_driver_page_view: { Args: { _slug: string }; Returns: undefined }
      track_driver_visit: {
        Args: {
          _event: string
          _slug: string
          _source?: string
          _visitor_key?: string
        }
        Returns: undefined
      }
      wfw_relation_allowed: {
        Args: { _client: string; _driver: string }
        Returns: boolean
      }
      woman_for_woman_eligible: {
        Args: { _client: string; _driver: string }
        Returns: boolean
      }
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
