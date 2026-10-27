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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_assignment_rules: {
        Row: {
          country: string | null
          created_at: string
          id: string
          members: string[]
          org_id: string
          position: number
          region: string | null
          segment_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          members?: string[]
          org_id?: string
          position?: number
          region?: string | null
          segment_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          members?: string[]
          org_id?: string
          position?: number
          region?: string | null
          segment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_assignment_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_assignment_rules_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      account_plans: {
        Row: {
          account_id: string
          action_plan: string | null
          competitors: string | null
          created_at: string
          created_by: string | null
          current_state: string | null
          id: string
          initiatives: string | null
          objectives: string | null
          org_id: string | null
          pains: string | null
          risks: string | null
          updated_at: string
          updated_by: string | null
          whitespace: string | null
        }
        Insert: {
          account_id: string
          action_plan?: string | null
          competitors?: string | null
          created_at?: string
          created_by?: string | null
          current_state?: string | null
          id?: string
          initiatives?: string | null
          objectives?: string | null
          org_id?: string | null
          pains?: string | null
          risks?: string | null
          updated_at?: string
          updated_by?: string | null
          whitespace?: string | null
        }
        Update: {
          account_id?: string
          action_plan?: string | null
          competitors?: string | null
          created_at?: string
          created_by?: string | null
          current_state?: string | null
          id?: string
          initiatives?: string | null
          objectives?: string | null
          org_id?: string | null
          pains?: string | null
          risks?: string | null
          updated_at?: string
          updated_by?: string | null
          whitespace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      account_signals: {
        Row: {
          account_id: string
          found_at: string
          id: string
          kind: string
          org_id: string
          published_at: string | null
          relevance: string
          source: string
          summary: string
          title: string
          url: string
        }
        Insert: {
          account_id: string
          found_at?: string
          id?: string
          kind?: string
          org_id?: string
          published_at?: string | null
          relevance?: string
          source?: string
          summary?: string
          title: string
          url: string
        }
        Update: {
          account_id?: string
          found_at?: string
          id?: string
          kind?: string
          org_id?: string
          published_at?: string | null
          relevance?: string
          source?: string
          summary?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_signals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      account_touches: {
        Row: {
          account_id: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          occurred_at: string
          org_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          org_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          org_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_touches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_touches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          abm_tier: string | null
          auto_researched_at: string | null
          country: string | null
          created_at: string
          created_by: string | null
          domain: string | null
          field_sources: Json
          health: string | null
          id: string
          industry: string | null
          is_target: boolean
          linkedin_url: string | null
          name: string
          notes: string | null
          org_id: string | null
          owner_id: string | null
          segment_id: string | null
          signals_checked_at: string | null
          size: string | null
          tier: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          abm_tier?: string | null
          auto_researched_at?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          domain?: string | null
          field_sources?: Json
          health?: string | null
          id?: string
          industry?: string | null
          is_target?: boolean
          linkedin_url?: string | null
          name: string
          notes?: string | null
          org_id?: string | null
          owner_id?: string | null
          segment_id?: string | null
          signals_checked_at?: string | null
          size?: string | null
          tier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          abm_tier?: string | null
          auto_researched_at?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          domain?: string | null
          field_sources?: Json
          health?: string | null
          id?: string
          industry?: string | null
          is_target?: boolean
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          org_id?: string | null
          owner_id?: string | null
          segment_id?: string | null
          signals_checked_at?: string | null
          size?: string | null
          tier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          account_id: string | null
          body: string
          created_at: string
          created_by: string | null
          deal_id: string | null
          id: string
          kind: string
          occurred_at: string
          org_id: string | null
          person_id: string | null
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          org_id?: string | null
          person_id?: string | null
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          org_id?: string | null
          person_id?: string | null
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          channel: string
          created_at: string
          id: string
          mode: string
          org_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          mode?: string
          org_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          mode?: string
          org_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_pending_actions: {
        Row: {
          args: Json
          conversation_id: string | null
          created_at: string
          decided_at: string | null
          id: string
          org_id: string
          result: string
          source: string
          status: string
          summary: string
          tool: string
          user_id: string
        }
        Insert: {
          args?: Json
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          org_id: string
          result?: string
          source?: string
          status?: string
          summary?: string
          tool: string
          user_id: string
        }
        Update: {
          args?: Json
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          org_id?: string
          result?: string
          source?: string
          status?: string
          summary?: string
          tool?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_pending_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_pending_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          created_at: string
          created_by: string | null
          decided_by: string | null
          evidence: string | null
          id: string
          kind: string
          org_id: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_by?: string | null
          evidence?: string | null
          id?: string
          kind: string
          org_id?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_by?: string | null
          evidence?: string | null
          id?: string
          kind?: string
          org_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      background_jobs: {
        Row: {
          cancel_requested: boolean
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          kind: string
          label: string
          org_id: string
          result: Json | null
          retry_of: string | null
          status: string
          step: string | null
          target_id: string | null
          target_type: string | null
          user_id: string
        }
        Insert: {
          cancel_requested?: boolean
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind: string
          label?: string
          org_id?: string
          result?: Json | null
          retry_of?: string | null
          status?: string
          step?: string | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string
        }
        Update: {
          cancel_requested?: boolean
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind?: string
          label?: string
          org_id?: string
          result?: Json | null
          retry_of?: string | null
          status?: string
          step?: string | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_jobs_retry_of_fkey"
            columns: ["retry_of"]
            isOneToOne: false
            referencedRelation: "background_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cac_costs: {
        Row: {
          amount: number
          channel: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string | null
          period: string
          segment_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          period: string
          segment_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          period?: string
          segment_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cac_costs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cac_costs_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          id: string
          next_steps: string | null
          occurred_at: string | null
          org_id: string | null
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          next_steps?: string | null
          occurred_at?: string | null
          org_id?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          next_steps?: string | null
          occurred_at?: string | null
          org_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_results: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string | null
          person_id: string
          result: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          person_id: string
          result?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          person_id?: string
          result?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_results_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_results_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channel: string | null
          copy: string | null
          created_at: string
          created_by: string | null
          id: string
          list_description: string | null
          meetings_booked: number
          name: string
          org_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel?: string | null
          copy?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          list_description?: string | null
          meetings_booked?: number
          name: string
          org_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel?: string | null
          copy?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          list_description?: string | null
          meetings_booked?: number
          name?: string
          org_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_clinics: {
        Row: {
          case_giver: string
          closing: string
          coaches: string
          created_at: string
          created_by: string | null
          deal_id: string | null
          dialogue: string
          edge: string
          held_on: string
          help_needed: string
          id: string
          mirror_feeling: string
          mirror_gesture: string
          mirror_image: string
          next_steps: string
          org_id: string | null
          situation: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_giver?: string
          closing?: string
          coaches?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          dialogue?: string
          edge?: string
          held_on?: string
          help_needed?: string
          id?: string
          mirror_feeling?: string
          mirror_gesture?: string
          mirror_image?: string
          next_steps?: string
          org_id?: string | null
          situation?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_giver?: string
          closing?: string
          coaches?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          dialogue?: string
          edge?: string
          held_on?: string
          help_needed?: string
          id?: string
          mirror_feeling?: string
          mirror_gesture?: string
          mirror_image?: string
          next_steps?: string
          org_id?: string | null
          situation?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_clinics_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_clinics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_links: {
        Row: {
          channel: string
          chat_id: string | null
          code_expires_at: string | null
          created_at: string
          daily_digest: boolean
          id: string
          link_code: string | null
          linked_at: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          chat_id?: string | null
          code_expires_at?: string | null
          created_at?: string
          daily_digest?: boolean
          id?: string
          link_code?: string | null
          linked_at?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          chat_id?: string | null
          code_expires_at?: string | null
          created_at?: string
          daily_digest?: boolean
          id?: string
          link_code?: string | null
          linked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      deal_lines: {
        Row: {
          billing: string
          created_at: string
          created_by: string | null
          deal_id: string
          discount_pct: number
          id: string
          name: string
          org_id: string
          product_id: string | null
          quantity: number
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          billing?: string
          created_at?: string
          created_by?: string | null
          deal_id: string
          discount_pct?: number
          id?: string
          name: string
          org_id?: string
          product_id?: string | null
          quantity?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Update: {
          billing?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string
          discount_pct?: number
          id?: string
          name?: string
          org_id?: string
          product_id?: string | null
          quantity?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_lines_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_offers: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          lines: Json
          notes: string
          one_off_total: number
          org_id: string | null
          recurring_total: number
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          lines?: Json
          notes?: string
          one_off_total?: number
          org_id?: string | null
          recurring_total?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          lines?: Json
          notes?: string
          one_off_total?: number
          org_id?: string | null
          recurring_total?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_offers_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_offers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_registrations: {
        Row: {
          account_id: string | null
          account_name: string
          created_at: string
          created_by: string | null
          deal_id: string | null
          expires_at: string | null
          id: string
          notes: string | null
          org_id: string | null
          partner_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          account_name: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          partner_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          partner_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_registrations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_registrations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_registrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_registrations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          deal_id: string
          from_stage: string | null
          id: string
          org_id: string | null
          to_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          from_stage?: string | null
          id?: string
          org_id?: string | null
          to_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          from_stage?: string | null
          id?: string
          org_id?: string | null
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          board_group: string | null
          color: string | null
          created_at: string
          id: string
          key: string
          kind: string
          label: string
          org_id: string
          position: number
          probability: number
        }
        Insert: {
          board_group?: string | null
          color?: string | null
          created_at?: string
          id?: string
          key: string
          kind?: string
          label: string
          org_id?: string
          position?: number
          probability?: number
        }
        Update: {
          board_group?: string | null
          color?: string | null
          created_at?: string
          id?: string
          key?: string
          kind?: string
          label?: string
          org_id?: string
          position?: number
          probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          account_id: string | null
          amount: number | null
          close_date: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          external_id: string | null
          forecast_category: string | null
          gross_margin: number | null
          health: string | null
          id: string
          lead_source_id: string | null
          lost_competitor: string | null
          lost_reason: string | null
          lost_reason_detail: string | null
          meddpicc: Json
          name: string
          one_off_amount: number | null
          org_id: string | null
          owner_id: string | null
          partner_id: string | null
          probability: number | null
          segment_id: string | null
          slip_count: number
          source: string | null
          stage: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          close_date?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          forecast_category?: string | null
          gross_margin?: number | null
          health?: string | null
          id?: string
          lead_source_id?: string | null
          lost_competitor?: string | null
          lost_reason?: string | null
          lost_reason_detail?: string | null
          meddpicc?: Json
          name: string
          one_off_amount?: number | null
          org_id?: string | null
          owner_id?: string | null
          partner_id?: string | null
          probability?: number | null
          segment_id?: string | null
          slip_count?: number
          source?: string | null
          stage: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          close_date?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          forecast_category?: string | null
          gross_margin?: number | null
          health?: string | null
          id?: string
          lead_source_id?: string | null
          lost_competitor?: string | null
          lost_reason?: string | null
          lost_reason_detail?: string | null
          meddpicc?: Json
          name?: string
          one_off_amount?: number | null
          org_id?: string | null
          owner_id?: string | null
          partner_id?: string | null
          probability?: number | null
          segment_id?: string | null
          slip_count?: number
          source?: string | null
          stage?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_fkey"
            columns: ["org_id", "stage"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["org_id", "key"]
          },
        ]
      }
      debates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          level: string
          org_id: string | null
          participants: string[]
          subject_id: string | null
          subject_type: string | null
          synthesis: Json
          topic: string
          turns: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          level: string
          org_id?: string | null
          participants?: string[]
          subject_id?: string | null
          subject_type?: string | null
          synthesis?: Json
          topic: string
          turns?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          level?: string
          org_id?: string | null
          participants?: string[]
          subject_id?: string | null
          subject_type?: string | null
          synthesis?: Json
          topic?: string
          turns?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      discoveries: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          dedupe_key: string
          detail: Json
          dismiss_reason: string | null
          id: string
          kind: string
          name: string
          org_id: string
          reason: string
          result_id: string | null
          source: string
          status: string
          week: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          dedupe_key: string
          detail?: Json
          dismiss_reason?: string | null
          id?: string
          kind: string
          name: string
          org_id?: string
          reason?: string
          result_id?: string | null
          source?: string
          status?: string
          week?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          dedupe_key?: string
          detail?: Json
          dismiss_reason?: string | null
          id?: string
          kind?: string
          name?: string
          org_id?: string
          reason?: string
          result_id?: string | null
          source?: string
          status?: string
          week?: string
        }
        Relationships: [
          {
            foreignKeyName: "discoveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_doc_summaries: {
        Row: {
          account_id: string | null
          created_by: string | null
          file_id: string
          file_modified_at: string | null
          id: string
          org_id: string
          summary: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_by?: string | null
          file_id: string
          file_modified_at?: string | null
          id?: string
          org_id?: string
          summary: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_by?: string | null
          file_id?: string
          file_modified_at?: string | null
          id?: string
          org_id?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_doc_summaries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_doc_summaries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_folders: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          created_by_app: boolean
          folder_id: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_app?: boolean
          folder_id: string
          id?: string
          name?: string
          org_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_app?: boolean
          folder_id?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_folders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_folders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          org_id: string | null
          stage: string | null
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          org_id?: string | null
          stage?: string | null
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          org_id?: string | null
          stage?: string | null
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      field_edit_log: {
        Row: {
          after: Json | null
          before: Json
          changed_at: string
          changed_by: string | null
          id: string
          op: string
          org_id: string
          row_id: string
          table_name: string
          undone_at: string | null
          undone_by: string | null
        }
        Insert: {
          after?: Json | null
          before: Json
          changed_at?: string
          changed_by?: string | null
          id?: string
          op: string
          org_id: string
          row_id: string
          table_name: string
          undone_at?: string | null
          undone_by?: string | null
        }
        Update: {
          after?: Json | null
          before?: Json
          changed_at?: string
          changed_by?: string | null
          id?: string
          op?: string
          org_id?: string
          row_id?: string
          table_name?: string
          undone_at?: string | null
          undone_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_edit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_cost_lines: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          name: string
          notes: string
          org_id: string | null
          segment_id: string | null
          starts_on: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          name: string
          notes?: string
          org_id?: string | null
          segment_id?: string | null
          starts_on?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          notes?: string
          org_id?: string | null
          segment_id?: string | null
          starts_on?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_cost_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_cost_lines_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_invoices: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          deal_id: string | null
          due_on: string | null
          id: string
          issued_on: string
          notes: string
          number: string
          org_id: string | null
          paid_on: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_on?: string | null
          id?: string
          issued_on?: string
          notes?: string
          number?: string
          org_id?: string | null
          paid_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_on?: string | null
          id?: string
          issued_on?: string
          notes?: string
          number?: string
          org_id?: string | null
          paid_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_months: {
        Row: {
          cash_end: number | null
          closed_at: string | null
          costs: number | null
          created_at: string
          created_by: string | null
          id: string
          month: string
          notes: string
          org_id: string | null
          revenue: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cash_end?: number | null
          closed_at?: string | null
          costs?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          notes?: string
          org_id?: string | null
          revenue?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cash_end?: number | null
          closed_at?: string | null
          costs?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          notes?: string
          org_id?: string | null
          revenue?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_months_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_settings: {
        Row: {
          annual_discount_pct: number
          cash_as_of: string | null
          created_at: string
          created_by: string | null
          horizon_months: number
          include_pipeline: boolean
          opening_cash: number
          org_id: string
          plan_assumptions: Json
          scenario_spread_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          annual_discount_pct?: number
          cash_as_of?: string | null
          created_at?: string
          created_by?: string | null
          horizon_months?: number
          include_pipeline?: boolean
          opening_cash?: number
          org_id?: string
          plan_assumptions?: Json
          scenario_spread_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          annual_discount_pct?: number
          cash_as_of?: string | null
          created_at?: string
          created_by?: string | null
          horizon_months?: number
          include_pipeline?: boolean
          opening_cash?: number
          org_id?: string
          plan_assumptions?: Json
          scenario_spread_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_snapshots: {
        Row: {
          assumptions: Json
          created_at: string
          created_by: string | null
          id: string
          month: string
          org_id: string | null
          summary: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assumptions?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          org_id?: string | null
          summary?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assumptions?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          org_id?: string | null
          summary?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gtm_advisories: {
        Row: {
          created_at: string
          created_by: string | null
          goal: string
          horizon: string
          id: string
          org_id: string | null
          result: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          goal: string
          horizon?: string
          id?: string
          org_id?: string | null
          result?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          goal?: string
          horizon?: string
          id?: string
          org_id?: string | null
          result?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gtm_advisories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gtm_artifacts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          meta: Json
          org_id: string | null
          persona: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          meta?: Json
          org_id?: string | null
          persona?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          meta?: Json
          org_id?: string | null
          persona?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "gtm_artifacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gtm_experiments: {
        Row: {
          audience: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          hypothesis: string
          id: string
          journey_id: string | null
          learning: string
          metric: string
          org_id: string | null
          prototype: string
          result: string
          starts_on: string | null
          status: string
          target: string
          title: string
          updated_at: string
          updated_by: string | null
          success_threshold: string
          close_rule: string
          review_on: string | null
          decision: string | null
          decided_at: string | null
          decided_by: string | null
          change_element: string | null
          change_note: string
        }
        Insert: {
          audience?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          hypothesis?: string
          id?: string
          journey_id?: string | null
          learning?: string
          metric?: string
          org_id?: string | null
          prototype?: string
          result?: string
          starts_on?: string | null
          status?: string
          target?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          success_threshold?: string
          close_rule?: string
          review_on?: string | null
          decision?: string | null
          decided_at?: string | null
          decided_by?: string | null
          change_element?: string | null
          change_note?: string
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          hypothesis?: string
          id?: string
          journey_id?: string | null
          learning?: string
          metric?: string
          org_id?: string | null
          prototype?: string
          result?: string
          starts_on?: string | null
          status?: string
          target?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          success_threshold?: string
          close_rule?: string
          review_on?: string | null
          decision?: string | null
          decided_at?: string | null
          decided_by?: string | null
          change_element?: string | null
          change_note?: string
        }
        Relationships: [
          {
            foreignKeyName: "gtm_experiments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "u_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gtm_experiments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      icp_profiles: {
        Row: {
          adoption: string | null
          anti_icp: string | null
          company_size: string | null
          countries: string[]
          created_at: string
          created_by: string | null
          field_sources: Json
          funding_signals: string | null
          geography: string | null
          growth_stage: string | null
          hiring_signals: string | null
          id: string
          industries: string | null
          max_employees: number | null
          min_employees: number | null
          name: string
          org_id: string | null
          pains: string | null
          search_keywords: string[]
          segment_id: string | null
          seniorities: string[]
          target_titles: string[]
          tech_stack: string | null
          updated_at: string
          updated_by: string | null
          why_fit: string | null
        }
        Insert: {
          adoption?: string | null
          anti_icp?: string | null
          company_size?: string | null
          countries?: string[]
          created_at?: string
          created_by?: string | null
          field_sources?: Json
          funding_signals?: string | null
          geography?: string | null
          growth_stage?: string | null
          hiring_signals?: string | null
          id?: string
          industries?: string | null
          max_employees?: number | null
          min_employees?: number | null
          name: string
          org_id?: string | null
          pains?: string | null
          search_keywords?: string[]
          segment_id?: string | null
          seniorities?: string[]
          target_titles?: string[]
          tech_stack?: string | null
          updated_at?: string
          updated_by?: string | null
          why_fit?: string | null
        }
        Update: {
          adoption?: string | null
          anti_icp?: string | null
          company_size?: string | null
          countries?: string[]
          created_at?: string
          created_by?: string | null
          field_sources?: Json
          funding_signals?: string | null
          geography?: string | null
          growth_stage?: string | null
          hiring_signals?: string | null
          id?: string
          industries?: string | null
          max_employees?: number | null
          min_employees?: number | null
          name?: string
          org_id?: string | null
          pains?: string | null
          search_keywords?: string[]
          segment_id?: string | null
          seniorities?: string[]
          target_titles?: string[]
          tech_stack?: string | null
          updated_at?: string
          updated_by?: string | null
          why_fit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icp_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icp_profiles_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          created_count: number
          decided_at: string | null
          decided_by: string | null
          error_count: number
          id: string
          kind: string
          lead_source_id: string | null
          org_id: string
          row_count: number
          status: string
          undone_at: string | null
          undone_by: string | null
          updated_at: string
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_count?: number
          decided_at?: string | null
          decided_by?: string | null
          error_count?: number
          id?: string
          kind: string
          lead_source_id?: string | null
          org_id?: string
          row_count?: number
          status?: string
          undone_at?: string | null
          undone_by?: string | null
          updated_at?: string
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_count?: number
          decided_at?: string | null
          decided_by?: string | null
          error_count?: number
          id?: string
          kind?: string
          lead_source_id?: string | null
          org_id?: string
          row_count?: number
          status?: string
          undone_at?: string | null
          undone_by?: string | null
          updated_at?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          action: string
          applied_at: string | null
          batch_id: string
          created_at: string
          error: string | null
          id: string
          line: number
          org_id: string
          raw: Json
          reason: string | null
          result: Json | null
          status: string
          summary: string
        }
        Insert: {
          action?: string
          applied_at?: string | null
          batch_id: string
          created_at?: string
          error?: string | null
          id?: string
          line: number
          org_id?: string
          raw?: Json
          reason?: string | null
          result?: Json | null
          status?: string
          summary?: string
        }
        Update: {
          action?: string
          applied_at?: string | null
          batch_id?: string
          created_at?: string
          error?: string | null
          id?: string
          line?: number
          org_id?: string
          raw?: Json
          reason?: string | null
          result?: Json | null
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_usage: {
        Row: {
          cost: number
          created_at: string
          id: string
          need: string | null
          org_id: string
          service: string
          trigger: string
          user_id: string | null
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          need?: string | null
          org_id?: string
          service: string
          trigger?: string
          user_id?: string | null
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          need?: string | null
          org_id?: string
          service?: string
          trigger?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          org_id: string | null
          purpose: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          org_id?: string | null
          purpose?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          org_id?: string | null
          purpose?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_locks: {
        Row: {
          last_run_at: string | null
          locked_until: string | null
          name: string
          paused_reason: string | null
        }
        Insert: {
          last_run_at?: string | null
          locked_until?: string | null
          name: string
          paused_reason?: string | null
        }
        Update: {
          last_run_at?: string | null
          locked_until?: string | null
          name?: string
          paused_reason?: string | null
        }
        Relationships: []
      }
      knowledge_docs: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          mandatory: boolean
          org_id: string | null
          scope: string
          section: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mandatory?: boolean
          org_id?: string | null
          scope?: string
          section: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mandatory?: boolean
          org_id?: string | null
          scope?: string
          section?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_docs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          account_id: string | null
          channel: string
          deal_id: string | null
          error: string | null
          id: string
          lead_id: string | null
          lead_source_id: string | null
          org_id: string | null
          received_at: string
          status: string
          summary: string
        }
        Insert: {
          account_id?: string | null
          channel?: string
          deal_id?: string | null
          error?: string | null
          id?: string
          lead_id?: string | null
          lead_source_id?: string | null
          org_id?: string | null
          received_at?: string
          status: string
          summary?: string
        }
        Update: {
          account_id?: string | null
          channel?: string
          deal_id?: string | null
          error?: string | null
          id?: string
          lead_id?: string | null
          lead_source_id?: string | null
          org_id?: string | null
          received_at?: string
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_settings: {
        Row: {
          auto_enrich: boolean
          org_id: string
          qualification: Json
          sla: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_enrich?: boolean
          org_id?: string
          qualification?: Json
          sla?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_enrich?: boolean
          org_id?: string
          qualification?: Json
          sla?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          daily_limit: number
          day_count: number
          day_date: string | null
          default_stage: string
          id: string
          kind: string
          last_received_at: string | null
          max_per_request: number
          mode: string
          name: string
          org_id: string | null
          paused_reason: string | null
          received_count: number
          token_hash: string
          token_hint: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          day_count?: number
          day_date?: string | null
          default_stage?: string
          id?: string
          kind?: string
          last_received_at?: string | null
          max_per_request?: number
          mode?: string
          name: string
          org_id?: string | null
          paused_reason?: string | null
          received_count?: number
          token_hash: string
          token_hint?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          day_count?: number
          day_date?: string | null
          default_stage?: string
          id?: string
          kind?: string
          last_received_at?: string | null
          max_per_request?: number
          mode?: string
          name?: string
          org_id?: string | null
          paused_reason?: string | null
          received_count?: number
          token_hash?: string
          token_hint?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          account_id: string | null
          amount: number | null
          company: string
          contact_name: string | null
          contacted_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          disqualified_at: string | null
          disqualified_reason: string | null
          email: string | null
          enriched_at: string | null
          external_id: string | null
          flow: Json | null
          id: string
          lead_source_id: string | null
          mql_at: string | null
          next_step: string
          next_step_at: string | null
          notes: string
          opportunity_at: string | null
          org_id: string | null
          owner_id: string | null
          person_id: string | null
          qualification: Json | null
          qualified_at: string | null
          segment_id: string | null
          source: string | null
          sql_at: string | null
          stage: string
          stage_entered_at: string
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          company: string
          contact_name?: string | null
          contacted_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          disqualified_at?: string | null
          disqualified_reason?: string | null
          email?: string | null
          enriched_at?: string | null
          external_id?: string | null
          flow?: Json | null
          id?: string
          lead_source_id?: string | null
          mql_at?: string | null
          next_step?: string
          next_step_at?: string | null
          notes?: string
          opportunity_at?: string | null
          org_id?: string | null
          owner_id?: string | null
          person_id?: string | null
          qualification?: Json | null
          qualified_at?: string | null
          segment_id?: string | null
          source?: string | null
          sql_at?: string | null
          stage?: string
          stage_entered_at?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          company?: string
          contact_name?: string | null
          contacted_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          disqualified_at?: string | null
          disqualified_reason?: string | null
          email?: string | null
          enriched_at?: string | null
          external_id?: string | null
          flow?: Json | null
          id?: string
          lead_source_id?: string | null
          mql_at?: string | null
          next_step?: string
          next_step_at?: string | null
          notes?: string
          opportunity_at?: string | null
          org_id?: string | null
          owner_id?: string | null
          person_id?: string | null
          qualification?: Json | null
          qualified_at?: string | null
          segment_id?: string | null
          source?: string | null
          sql_at?: string | null
          stage?: string
          stage_entered_at?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          account_id: string | null
          agenda: string | null
          ai_brief: string | null
          attendees: string | null
          auto_prepped_at: string | null
          call_notes: Json
          call_review: string
          created_at: string
          created_by: string | null
          deal_id: string | null
          desired_outcome: string | null
          id: string
          listening_coaching: string
          listening_level: number | null
          listening_reflection: string
          materials: string | null
          next_steps: string | null
          notes: string | null
          objections: string | null
          objective: string | null
          org_id: string | null
          questions: string | null
          scheduled_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          agenda?: string | null
          ai_brief?: string | null
          attendees?: string | null
          auto_prepped_at?: string | null
          call_notes?: Json
          call_review?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          desired_outcome?: string | null
          id?: string
          listening_coaching?: string
          listening_level?: number | null
          listening_reflection?: string
          materials?: string | null
          next_steps?: string | null
          notes?: string | null
          objections?: string | null
          objective?: string | null
          org_id?: string | null
          questions?: string | null
          scheduled_at?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          agenda?: string | null
          ai_brief?: string | null
          attendees?: string | null
          auto_prepped_at?: string | null
          call_notes?: Json
          call_review?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          desired_outcome?: string | null
          id?: string
          listening_coaching?: string
          listening_level?: number | null
          listening_reflection?: string
          materials?: string | null
          next_steps?: string | null
          notes?: string | null
          objections?: string | null
          objective?: string | null
          org_id?: string | null
          questions?: string | null
          scheduled_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          account_id: string | null
          active: boolean
          content: string
          created_at: string
          id: string
          kind: string
          learned: boolean
          org_id: string
          pinned: boolean
          scope: string
          source: string
          supersedes: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          content: string
          created_at?: string
          id?: string
          kind?: string
          learned?: boolean
          org_id?: string
          pinned?: boolean
          scope?: string
          source?: string
          supersedes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          active?: boolean
          content?: string
          created_at?: string
          id?: string
          kind?: string
          learned?: boolean
          org_id?: string
          pinned?: boolean
          scope?: string
          source?: string
          supersedes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_pillars: {
        Row: {
          created_at: string
          created_by: string | null
          field_sources: Json
          id: string
          message: string | null
          org_id: string | null
          pain: string | null
          position: number
          proof: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field_sources?: Json
          id?: string
          message?: string | null
          org_id?: string | null
          pain?: string | null
          position?: number
          proof?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field_sources?: Json
          id?: string
          message?: string | null
          org_id?: string | null
          pain?: string | null
          position?: number
          proof?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_pillars_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mutual_action_items: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          done: boolean
          due_date: string | null
          id: string
          org_id: string | null
          owner_side: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          done?: boolean
          due_date?: string | null
          id?: string
          org_id?: string | null
          owner_side?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          done?: boolean
          due_date?: string | null
          id?: string
          org_id?: string | null
          owner_side?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mutual_action_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutual_action_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          daily_email: boolean
          daily_email_hour: number
          quiet_from: number
          quiet_to: number
          telegram: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_email?: boolean
          daily_email_hour?: number
          quiet_from?: number
          quiet_to?: number
          telegram?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_email?: boolean
          daily_email_hour?: number
          quiet_from?: number
          quiet_to?: number
          telegram?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          job_id: string | null
          kind: string
          link: string | null
          org_id: string
          read_at: string | null
          telegram_sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind: string
          link?: string | null
          org_id?: string
          read_at?: string | null
          telegram_sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          link?: string | null
          org_id?: string
          read_at?: string | null
          telegram_sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "background_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_sessions: {
        Row: {
          block_status: Json
          completed_at: string | null
          created_at: string
          depth: string
          diagnosis: Json | null
          findings: Json
          id: string
          opinions: Json | null
          org_id: string
          proposal: Json | null
          read_job_id: string | null
          sources: Json
          step: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_status?: Json
          completed_at?: string | null
          created_at?: string
          depth?: string
          diagnosis?: Json | null
          findings?: Json
          id?: string
          opinions?: Json | null
          org_id?: string
          proposal?: Json | null
          read_job_id?: string | null
          sources?: Json
          step?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          block_status?: Json
          completed_at?: string | null
          created_at?: string
          depth?: string
          diagnosis?: Json | null
          findings?: Json
          id?: string
          opinions?: Json | null
          org_id?: string
          proposal?: Json | null
          read_job_id?: string | null
          sources?: Json
          step?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_sessions_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_sessions_read_job_id_fkey"
            columns: ["read_job_id"]
            isOneToOne: false
            referencedRelation: "background_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_budgets: {
        Row: {
          monthly_limit: number | null
          org_id: string
          updated_at: string
          updated_by: string | null
          warn_pct: number
        }
        Insert: {
          monthly_limit?: number | null
          org_id?: string
          updated_at?: string
          updated_by?: string | null
          warn_pct?: number
        }
        Update: {
          monthly_limit?: number | null
          org_id?: string
          updated_at?: string
          updated_by?: string | null
          warn_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_budgets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          max_accounts: number | null
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_accounts?: number | null
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_accounts?: number | null
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          name: string
          website: string | null
        }
        Insert: {
          archived_at?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name: string
          website?: string | null
        }
        Update: {
          archived_at?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          contact: string | null
          created_at: string
          created_by: string | null
          id: string
          margin_pct: number | null
          name: string
          notes: string | null
          org_id: string | null
          partner_type: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          margin_pct?: number | null
          name: string
          notes?: string | null
          org_id?: string | null
          partner_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          margin_pct?: number | null
          name?: string
          notes?: string | null
          org_id?: string | null
          partner_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          account_id: string | null
          company: string | null
          created_at: string
          created_by: string | null
          crm_stage: string | null
          email: string | null
          full_name: string
          id: string
          linkedin_url: string | null
          org_id: string | null
          sequence_stage: string | null
          source: string | null
          tier: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          crm_stage?: string | null
          email?: string | null
          full_name?: string
          id?: string
          linkedin_url?: string | null
          org_id?: string | null
          sequence_stage?: string | null
          source?: string | null
          tier?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          crm_stage?: string | null
          email?: string | null
          full_name?: string
          id?: string
          linkedin_url?: string | null
          org_id?: string | null
          sequence_stage?: string | null
          source?: string | null
          tier?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_reveals: {
        Row: {
          apollo_person_id: string
          id: string
          name: string
          org_id: string
          phones: Json
          received_at: string | null
          requested_at: string
          requested_by: string | null
          stakeholder_id: string | null
          status: string
        }
        Insert: {
          apollo_person_id: string
          id?: string
          name?: string
          org_id?: string
          phones?: Json
          received_at?: string | null
          requested_at?: string
          requested_by?: string | null
          stakeholder_id?: string | null
          status?: string
        }
        Update: {
          apollo_person_id?: string
          id?: string
          name?: string
          org_id?: string
          phones?: Json
          received_at?: string | null
          requested_at?: string
          requested_by?: string | null
          stakeholder_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_reveals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_reveals_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      positioning: {
        Row: {
          alternatives: string | null
          best_customers: string | null
          category: string | null
          competitive_alternative: string | null
          copy_status: Json
          created_at: string
          created_by: string | null
          differentiation: string | null
          differentiator: string | null
          elevator_pitch: string | null
          field_sources: Json
          id: string
          key_benefit: string | null
          need: string | null
          one_liner: string | null
          org_id: string | null
          product_name: string | null
          short_pitch: string | null
          tagline: string | null
          target_customer: string | null
          trend: string | null
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          alternatives?: string | null
          best_customers?: string | null
          category?: string | null
          competitive_alternative?: string | null
          copy_status?: Json
          created_at?: string
          created_by?: string | null
          differentiation?: string | null
          differentiator?: string | null
          elevator_pitch?: string | null
          field_sources?: Json
          id?: string
          key_benefit?: string | null
          need?: string | null
          one_liner?: string | null
          org_id?: string | null
          product_name?: string | null
          short_pitch?: string | null
          tagline?: string | null
          target_customer?: string | null
          trend?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          alternatives?: string | null
          best_customers?: string | null
          category?: string | null
          competitive_alternative?: string | null
          copy_status?: Json
          created_at?: string
          created_by?: string | null
          differentiation?: string | null
          differentiator?: string | null
          elevator_pitch?: string | null
          field_sources?: Json
          id?: string
          key_benefit?: string | null
          need?: string | null
          one_liner?: string | null
          org_id?: string | null
          product_name?: string | null
          short_pitch?: string | null
          tagline?: string | null
          target_customer?: string | null
          trend?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "positioning_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      posthog_connections: {
        Row: {
          activation_event: string | null
          api_key_enc: string
          created_at: string
          created_by: string | null
          domain_property: string | null
          host: string
          key_hint: string
          last_error: string | null
          last_synced_at: string | null
          org_id: string
          paid_event: string | null
          project_id: string
          signup_event: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activation_event?: string | null
          api_key_enc: string
          created_at?: string
          created_by?: string | null
          domain_property?: string | null
          host?: string
          key_hint?: string
          last_error?: string | null
          last_synced_at?: string | null
          org_id: string
          paid_event?: string | null
          project_id: string
          signup_event?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activation_event?: string | null
          api_key_enc?: string
          created_at?: string
          created_by?: string | null
          domain_property?: string | null
          host?: string
          key_hint?: string
          last_error?: string | null
          last_synced_at?: string | null
          org_id?: string
          paid_event?: string | null
          project_id?: string
          signup_event?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posthog_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_usage: {
        Row: {
          account_id: string | null
          active_users_30d: number
          active_users_7d: number
          active_users_prev_7d: number
          domain: string
          events_30d: number
          id: string
          last_seen_at: string | null
          org_id: string
          synced_at: string
        }
        Insert: {
          account_id?: string | null
          active_users_30d?: number
          active_users_7d?: number
          active_users_prev_7d?: number
          domain: string
          events_30d?: number
          id?: string
          last_seen_at?: string | null
          org_id?: string
          synced_at?: string
        }
        Update: {
          account_id?: string | null
          active_users_30d?: number
          active_users_7d?: number
          active_users_prev_7d?: number
          domain?: string
          events_30d?: number
          id?: string
          last_seen_at?: string | null
          org_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_usage_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          billing: string
          cost: number | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          org_id: string
          price: number
          sku: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          billing?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name: string
          org_id?: string
          price?: number
          sku?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          billing?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          org_id?: string
          price?: number
          sku?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          current_org_id: string | null
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          current_org_id?: string | null
          email?: string | null
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          current_org_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_org_id_fkey"
            columns: ["current_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotas: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          org_id: string | null
          period: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          period: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          period?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      research_runs: {
        Row: {
          account_id: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          kind: string
          label: string
          org_id: string
          processor: string
          result: Json | null
          run_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind: string
          label?: string
          org_id?: string
          processor?: string
          result?: Json | null
          run_id?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind?: string
          label?: string
          org_id?: string
          processor?: string
          result?: Json | null
          run_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_runs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_budget_quarters: {
        Row: {
          actual_cost_to_serve: number | null
          actual_revenue: number | null
          created_at: string
          created_by: string | null
          id: string
          org_id: string | null
          period: string
          plan_acquisition: number | null
          plan_cost_to_serve: number | null
          plan_new_customers: number | null
          plan_revenue: number | null
          segment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_cost_to_serve?: number | null
          actual_revenue?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          period: string
          plan_acquisition?: number | null
          plan_cost_to_serve?: number | null
          plan_new_customers?: number | null
          plan_revenue?: number | null
          segment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_cost_to_serve?: number | null
          actual_revenue?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          period?: string
          plan_acquisition?: number | null
          plan_cost_to_serve?: number | null
          plan_new_customers?: number | null
          plan_revenue?: number | null
          segment_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "segment_budget_quarters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_budget_quarters_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_budgets: {
        Row: {
          actual_cost_to_serve: number | null
          actual_revenue: number | null
          created_at: string
          created_by: string | null
          id: string
          org_id: string | null
          plan_acquisition: number | null
          plan_cost_to_serve: number | null
          plan_new_customers: number | null
          plan_revenue: number | null
          segment_id: string
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          actual_cost_to_serve?: number | null
          actual_revenue?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          plan_acquisition?: number | null
          plan_cost_to_serve?: number | null
          plan_new_customers?: number | null
          plan_revenue?: number | null
          segment_id: string
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          actual_cost_to_serve?: number | null
          actual_revenue?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          plan_acquisition?: number | null
          plan_cost_to_serve?: number | null
          plan_new_customers?: number | null
          plan_revenue?: number | null
          segment_id?: string
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "segment_budgets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_budgets_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_targets: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          org_id: string | null
          period: string
          segment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          period: string
          segment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          period?: string
          segment_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "segment_targets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_targets_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          acv_max: number | null
          acv_min: number | null
          ae_per_se: number | null
          ae_quota: number | null
          cac_target: number | null
          created_at: string
          created_by: string | null
          cycle_days: number | null
          field_sources: Json
          gross_margin_pct: number | null
          id: string
          motion: string
          name: string
          notes: string | null
          org_id: string | null
          payback_months: number | null
          priority: number | null
          sdr_per_ae: number | null
          updated_at: string
          updated_by: string | null
          win_rate_target: number | null
        }
        Insert: {
          acv_max?: number | null
          acv_min?: number | null
          ae_per_se?: number | null
          ae_quota?: number | null
          cac_target?: number | null
          created_at?: string
          created_by?: string | null
          cycle_days?: number | null
          field_sources?: Json
          gross_margin_pct?: number | null
          id?: string
          motion?: string
          name: string
          notes?: string | null
          org_id?: string | null
          payback_months?: number | null
          priority?: number | null
          sdr_per_ae?: number | null
          updated_at?: string
          updated_by?: string | null
          win_rate_target?: number | null
        }
        Update: {
          acv_max?: number | null
          acv_min?: number | null
          ae_per_se?: number | null
          ae_quota?: number | null
          cac_target?: number | null
          created_at?: string
          created_by?: string | null
          cycle_days?: number | null
          field_sources?: Json
          gross_margin_pct?: number | null
          id?: string
          motion?: string
          name?: string
          notes?: string | null
          org_id?: string | null
          payback_months?: number | null
          priority?: number | null
          sdr_per_ae?: number | null
          updated_at?: string
          updated_by?: string | null
          win_rate_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "segments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sensing_notes: {
        Row: {
          account_id: string | null
          context: string
          created_at: string
          created_by: string | null
          emerging: string
          heard: string
          id: string
          interviewee: string
          journey_id: string | null
          kind: string
          listening_level: number | null
          occurred_on: string
          org_id: string | null
          surprised: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          context?: string
          created_at?: string
          created_by?: string | null
          emerging?: string
          heard?: string
          id?: string
          interviewee?: string
          journey_id?: string | null
          kind?: string
          listening_level?: number | null
          occurred_on?: string
          org_id?: string | null
          surprised?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          context?: string
          created_at?: string
          created_by?: string | null
          emerging?: string
          heard?: string
          id?: string
          interviewee?: string
          journey_id?: string | null
          kind?: string
          listening_level?: number | null
          occurred_on?: string
          org_id?: string | null
          surprised?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sensing_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensing_notes_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "u_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensing_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          account_id: string
          buying_role: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          linkedin_url: string | null
          name: string
          org_id: string | null
          phone: string | null
          priorities: string | null
          reports_to: string | null
          research: string | null
          support: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          buying_role?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          org_id?: string | null
          phone?: string | null
          priorities?: string | null
          reports_to?: string | null
          research?: string | null
          support?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          buying_role?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          org_id?: string | null
          phone?: string | null
          priorities?: string | null
          reports_to?: string | null
          research?: string | null
          support?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakeholders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakeholders_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connections: {
        Row: {
          account_name: string | null
          connected_by: string | null
          created_at: string
          key_hint: string
          last_error: string | null
          last_synced_at: string | null
          livemode: boolean
          org_id: string
          restricted: boolean
          status: string
          vault_secret_id: string
        }
        Insert: {
          account_name?: string | null
          connected_by?: string | null
          created_at?: string
          key_hint: string
          last_error?: string | null
          last_synced_at?: string | null
          livemode: boolean
          org_id: string
          restricted: boolean
          status?: string
          vault_secret_id: string
        }
        Update: {
          account_name?: string | null
          connected_by?: string | null
          created_at?: string
          key_hint?: string
          last_error?: string | null
          last_synced_at?: string | null
          livemode?: boolean
          org_id?: string
          restricted?: boolean
          status?: string
          vault_secret_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_snapshots: {
        Row: {
          active_customers: number
          churned_customers: number
          churned_mrr: number
          currency: string
          details: Json
          id: string
          logo_churn_pct: number | null
          mrr: number
          new_customers: number
          new_mrr: number
          org_id: string
          revenue_churn_pct: number | null
          taken_at: string
          trialing: number
          window_days: number
        }
        Insert: {
          active_customers: number
          churned_customers?: number
          churned_mrr?: number
          currency: string
          details?: Json
          id?: string
          logo_churn_pct?: number | null
          mrr: number
          new_customers?: number
          new_mrr?: number
          org_id: string
          revenue_churn_pct?: number | null
          taken_at?: string
          trialing?: number
          window_days?: number
        }
        Update: {
          active_customers?: number
          churned_customers?: number
          churned_mrr?: number
          currency?: string
          details?: Json
          id?: string
          logo_churn_pct?: number | null
          mrr?: number
          new_customers?: number
          new_mrr?: number
          org_id?: string
          revenue_churn_pct?: number | null
          taken_at?: string
          trialing?: number
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "stripe_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_changes: {
        Row: {
          applied_at: string | null
          base: Json
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          element: string
          id: string
          op: string
          org_id: string
          previous: Json | null
          status: string
          suggestion_id: string
          target_id: string | null
          target_table: string | null
          undo_until: string | null
          values: Json
        }
        Insert: {
          applied_at?: string | null
          base?: Json
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          element: string
          id?: string
          op: string
          org_id?: string
          previous?: Json | null
          status?: string
          suggestion_id: string
          target_id?: string | null
          target_table?: string | null
          undo_until?: string | null
          values?: Json
        }
        Update: {
          applied_at?: string | null
          base?: Json
          decided_at?: string | null
          decided_by?: string | null
          previous?: Json | null
          status?: string
          target_id?: string | null
          undo_until?: string | null
        }
        Relationships: []
      }
      strategy_links: {
        Row: { created_at: string; created_by: string | null; id: string; kind: string; org_id: string; ref_id: string; suggestion_id: string }
        Insert: { created_at?: string; created_by?: string | null; id?: string; kind: string; org_id?: string; ref_id: string; suggestion_id: string }
        Update: never
        Relationships: []
      }
      strategy_decisions: {
        Row: {
          decided_at: string
          decided_by: string
          decision: string
          evidence_fingerprint: string
          id: string
          org_id: string
          reason: string | null
          remind_at: string | null
          suggestion_id: string
        }
        Insert: {
          decided_at?: string
          decided_by?: string
          decision: string
          evidence_fingerprint: string
          id?: string
          org_id?: string
          reason?: string | null
          remind_at?: string | null
          suggestion_id: string
        }
        Update: {
          decided_at?: string
          decided_by?: string
          decision?: string
          evidence_fingerprint?: string
          id?: string
          org_id?: string
          reason?: string | null
          remind_at?: string | null
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_decisions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_decisions_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          action: Json | null
          body: string
          created_at: string
          dedupe_key: string
          detector: string
          id: string
          link: string | null
          notified_at: string | null
          org_id: string
          priority: number
          snoozed_until: string | null
          status: string
          strategy: Json | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action?: Json | null
          body?: string
          created_at?: string
          dedupe_key: string
          detector: string
          id?: string
          link?: string | null
          notified_at?: string | null
          org_id: string
          priority?: number
          snoozed_until?: string | null
          status?: string
          strategy?: Json | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action?: Json | null
          body?: string
          created_at?: string
          dedupe_key?: string
          detector?: string
          id?: string
          link?: string | null
          notified_at?: string | null
          org_id?: string
          priority?: number
          snoozed_until?: string | null
          status?: string
          strategy?: Json | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          done: boolean
          due_date: string | null
          id: string
          notes: string
          org_id: string | null
          owner_id: string | null
          source: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          notes?: string
          org_id?: string | null
          owner_id?: string | null
          source?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          notes?: string
          org_id?: string | null
          owner_id?: string | null
          source?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          org_id: string | null
          team_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          team_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          team_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          name: string
          org_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          name: string
          org_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          org_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_updates: {
        Row: {
          error: string | null
          payload: Json
          processed_at: string | null
          received_at: string
          update_id: number
        }
        Insert: {
          error?: string | null
          payload: Json
          processed_at?: string | null
          received_at?: string
          update_id: number
        }
        Update: {
          error?: string | null
          payload?: Json
          processed_at?: string | null
          received_at?: string
          update_id?: number
        }
        Relationships: []
      }
      trials: {
        Row: {
          activated_at: string | null
          company: string
          converted_at: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          mrr: number | null
          org_id: string | null
          plan: string
          posthog_person_id: string | null
          segment_id: string | null
          signed_up_at: string
          source: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activated_at?: string | null
          company?: string
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          mrr?: number | null
          org_id?: string | null
          plan?: string
          posthog_person_id?: string | null
          segment_id?: string | null
          signed_up_at?: string
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activated_at?: string | null
          company?: string
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          mrr?: number | null
          org_id?: string | null
          plan?: string
          posthog_person_id?: string | null
          segment_id?: string | null
          signed_up_at?: string
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      u_journeys: {
        Row: {
          ai_synthesis: string
          answers: Json
          created_at: string
          created_by: string | null
          id: string
          intention: string
          org_id: string | null
          phase: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_synthesis?: string
          answers?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          intention?: string
          org_id?: string | null
          phase?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_synthesis?: string
          answers?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          intention?: string
          org_id?: string | null
          phase?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "u_journeys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invites: { Args: never; Returns: number }
      apply_account_assignment: { Args: { _rows: Json }; Returns: Json }
      archive_organization: {
        Args: { _archived: boolean; _org: string }
        Returns: undefined
      }
      create_organization: {
        Args: { _name: string; _segments?: string }
        Returns: string
      }
      create_organization_full: {
        Args: {
          _currency?: string
          _name: string
          _segments?: string
          _website?: string
        }
        Returns: string
      }
      current_org: { Args: never; Returns: string }
      delete_organization: {
        Args: { _confirm_name: string; _org: string }
        Returns: undefined
      }
      has_org_role: {
        Args: { _org: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_finance_member: { Args: { _org: string }; Returns: boolean }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      remove_stripe_key: { Args: never; Returns: undefined }
      reorder_deal_stages: { Args: { _keys: string[] }; Returns: undefined }
      seed_deal_stages: { Args: { _org: string }; Returns: undefined }
      set_stripe_key: { Args: { _key: string }; Returns: undefined }
      shares_org: { Args: { _user: string }; Returns: boolean }
      stripe_key_for: { Args: { _org: string }; Returns: string }
      undo_field_edit: { Args: { _log: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "owner"
        | "sales_leader"
        | "marketing"
        | "sdr"
        | "ae"
        | "se"
        | "cs"
        | "deal_desk"
        | "enablement"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "owner",
        "sales_leader",
        "marketing",
        "sdr",
        "ae",
        "se",
        "cs",
        "deal_desk",
        "enablement",
      ],
    },
  },
} as const
