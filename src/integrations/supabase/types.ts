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
          city: string | null
          created_at: string
          driver_id: string
          id: string
          legal_form: string | null
          legal_name: string | null
          postal_code: string | null
          siret: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          driver_id: string
          id?: string
          legal_form?: string | null
          legal_name?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          legal_form?: string | null
          legal_name?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string
          vat_number?: string | null
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
          availability: string[]
          billing_legal_info: string | null
          bio: string | null
          booking_notice: string | null
          business_name: string | null
          city: string | null
          created_at: string
          facebook_url: string | null
          instagram_url: string | null
          languages: string[]
          linkedin_url: string | null
          long_distance: boolean
          on_duty: boolean
          page_published: boolean
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
          tiktok_url: string | null
          updated_at: string
          user_id: string
          vat_applicable: boolean
          verification_status: Database["public"]["Enums"]["verification_status"]
          vtc_card_number: string | null
          whatsapp_number: string | null
          zone: string | null
        }
        Insert: {
          accepting_requests?: boolean
          admin_note?: string | null
          airports?: string[]
          availability?: string[]
          billing_legal_info?: string | null
          bio?: string | null
          booking_notice?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          facebook_url?: string | null
          instagram_url?: string | null
          languages?: string[]
          linkedin_url?: string | null
          long_distance?: boolean
          on_duty?: boolean
          page_published?: boolean
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
          tiktok_url?: string | null
          updated_at?: string
          user_id: string
          vat_applicable?: boolean
          verification_status?: Database["public"]["Enums"]["verification_status"]
          vtc_card_number?: string | null
          whatsapp_number?: string | null
          zone?: string | null
        }
        Update: {
          accepting_requests?: boolean
          admin_note?: string | null
          airports?: string[]
          availability?: string[]
          billing_legal_info?: string | null
          bio?: string | null
          booking_notice?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          facebook_url?: string | null
          instagram_url?: string | null
          languages?: string[]
          linkedin_url?: string | null
          long_distance?: boolean
          on_duty?: boolean
          page_published?: boolean
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
          tiktok_url?: string | null
          updated_at?: string
          user_id?: string
          vat_applicable?: boolean
          verification_status?: Database["public"]["Enums"]["verification_status"]
          vtc_card_number?: string | null
          whatsapp_number?: string | null
          zone?: string | null
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
      invoices: {
        Row: {
          amount_ht: number
          amount_ttc: number
          auto_generated: boolean
          client_id: string | null
          created_at: string
          description: string | null
          driver_id: string
          due_on: string | null
          id: string
          issued_on: string
          number: string
          paid_at: string | null
          payment_method: string | null
          ride_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          vat_rate: number
        }
        Insert: {
          amount_ht?: number
          amount_ttc?: number
          auto_generated?: boolean
          client_id?: string | null
          created_at?: string
          description?: string | null
          driver_id: string
          due_on?: string | null
          id?: string
          issued_on?: string
          number: string
          paid_at?: string | null
          payment_method?: string | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          amount_ht?: number
          amount_ttc?: number
          auto_generated?: boolean
          client_id?: string | null
          created_at?: string
          description?: string | null
          driver_id?: string
          due_on?: string | null
          id?: string
          issued_on?: string
          number?: string
          paid_at?: string | null
          payment_method?: string | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
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
          client_id: string
          comment: string | null
          created_at: string
          driver_id: string
          driver_message: string | null
          dropoff_address: string
          id: string
          luggage: number
          passengers: number
          pickup_address: string
          preferred_contact: string | null
          proposed_price: number | null
          proposed_time: string | null
          round_trip: boolean
          scheduled_at: string
          special_needs: string | null
          status: Database["public"]["Enums"]["ride_status"]
          trip_type: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          driver_id: string
          driver_message?: string | null
          dropoff_address: string
          id?: string
          luggage?: number
          passengers?: number
          pickup_address: string
          preferred_contact?: string | null
          proposed_price?: number | null
          proposed_time?: string | null
          round_trip?: boolean
          scheduled_at: string
          special_needs?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          trip_type?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          driver_id?: string
          driver_message?: string | null
          dropoff_address?: string
          id?: string
          luggage?: number
          passengers?: number
          pickup_address?: string
          preferred_contact?: string | null
          proposed_price?: number | null
          proposed_time?: string | null
          round_trip?: boolean
          scheduled_at?: string
          special_needs?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          trip_type?: string | null
          updated_at?: string
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
          cancel_decided_at: string | null
          cancel_decided_by: string | null
          cancel_request_reason: string | null
          cancel_request_status: string | null
          cancel_requested_at: string | null
          cancel_requested_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
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
          pickup_address: string
          price: number | null
          request_id: string | null
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        Insert: {
          cancel_decided_at?: string | null
          cancel_decided_by?: string | null
          cancel_request_reason?: string | null
          cancel_request_status?: string | null
          cancel_requested_at?: string | null
          cancel_requested_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          pickup_address: string
          price?: number | null
          request_id?: string | null
          scheduled_at: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Update: {
          cancel_decided_at?: string | null
          cancel_decided_by?: string | null
          cancel_request_reason?: string | null
          cancel_request_status?: string | null
          cancel_requested_at?: string | null
          cancel_requested_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          pickup_address?: string
          price?: number | null
          request_id?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
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
          brand: string | null
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
          luggage_capacity: number
          luggage_help: boolean
          max_passengers: number
          mileage: number | null
          model: string | null
          next_service_date: string | null
          pets_allowed: boolean
          photo_interior_url: string | null
          photo_url: string | null
          plate: string | null
          quiet_ride: boolean
          updated_at: string
          water: boolean
          year: number | null
        }
        Insert: {
          accessible?: boolean
          air_conditioning?: boolean
          brand?: string | null
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
          luggage_capacity?: number
          luggage_help?: boolean
          max_passengers?: number
          mileage?: number | null
          model?: string | null
          next_service_date?: string | null
          pets_allowed?: boolean
          photo_interior_url?: string | null
          photo_url?: string | null
          plate?: string | null
          quiet_ride?: boolean
          updated_at?: string
          water?: boolean
          year?: number | null
        }
        Update: {
          accessible?: boolean
          air_conditioning?: boolean
          brand?: string | null
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
          luggage_capacity?: number
          luggage_help?: boolean
          max_passengers?: number
          mileage?: number | null
          model?: string | null
          next_service_date?: string | null
          pets_allowed?: boolean
          photo_interior_url?: string | null
          photo_url?: string | null
          plate?: string | null
          quiet_ride?: boolean
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
      driver_available_between: {
        Args: { _driver: string; _end: string; _start: string }
        Returns: boolean
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
          air_conditioning: boolean
          airports: string[]
          availability: string[]
          avatar_url: string
          bio: string
          booking_notice: string
          business_name: string
          card_payment: boolean
          chargers: boolean
          city: string
          company_verified: boolean
          facebook_url: string
          full_name: string
          instagram_url: string
          languages: string[]
          linkedin_url: string
          long_distance: boolean
          luggage_capacity: number
          luggage_help: boolean
          max_passengers: number
          member_since: string
          pets_allowed: boolean
          public_intro: string
          public_phone: string
          quiet_ride: boolean
          service_areas: string[]
          services: string[]
          slug: string
          stations: string[]
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
      is_verified_driver: { Args: { _driver: string }; Returns: boolean }
      notify_counterparty: {
        Args: { _kind: string; _recipient: string }
        Returns: undefined
      }
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
      verification_status:
        | "incomplete"
        | "pending"
        | "verified"
        | "changes_requested"
        | "rejected"
        | "suspended"
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
      ],
      verification_status: [
        "incomplete",
        "pending",
        "verified",
        "changes_requested",
        "rejected",
        "suspended",
      ],
    },
  },
} as const
