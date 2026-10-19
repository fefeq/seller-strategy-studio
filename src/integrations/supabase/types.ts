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
          created_at: string
          created_by: string | null
          domain: string | null
          health: string | null
          id: string
          industry: string | null
          is_target: boolean
          name: string
          notes: string | null
          org_id: string | null
          owner_id: string | null
          segment_id: string | null
          size: string | null
          tier: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          abm_tier?: string | null
          created_at?: string
          created_by?: string | null
          domain?: string | null
          health?: string | null
          id?: string
          industry?: string | null
          is_target?: boolean
          name: string
          notes?: string | null
          org_id?: string | null
          owner_id?: string | null
          segment_id?: string | null
          size?: string | null
          tier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          abm_tier?: string | null
          created_at?: string
          created_by?: string | null
          domain?: string | null
          health?: string | null
          id?: string
          industry?: string | null
          is_target?: boolean
          name?: string
          notes?: string | null
          org_id?: string | null
          owner_id?: string | null
          segment_id?: string | null
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
      deals: {
        Row: {
          account_id: string | null
          amount: number | null
          close_date: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          forecast_category: string | null
          health: string | null
          id: string
          meddpicc: Json
          name: string
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
          forecast_category?: string | null
          health?: string | null
          id?: string
          meddpicc?: Json
          name: string
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
        Update: {
          account_id?: string | null
          amount?: number | null
          close_date?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          forecast_category?: string | null
          health?: string | null
          id?: string
          meddpicc?: Json
          name?: string
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
          created_at: string
          created_by: string | null
          funding_signals: string | null
          geography: string | null
          growth_stage: string | null
          hiring_signals: string | null
          id: string
          industries: string | null
          name: string
          org_id: string | null
          segment_id: string | null
          tech_stack: string | null
          updated_at: string
          updated_by: string | null
          why_fit: string | null
        }
        Insert: {
          adoption?: string | null
          anti_icp?: string | null
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          funding_signals?: string | null
          geography?: string | null
          growth_stage?: string | null
          hiring_signals?: string | null
          id?: string
          industries?: string | null
          name: string
          org_id?: string | null
          segment_id?: string | null
          tech_stack?: string | null
          updated_at?: string
          updated_by?: string | null
          why_fit?: string | null
        }
        Update: {
          adoption?: string | null
          anti_icp?: string | null
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          funding_signals?: string | null
          geography?: string | null
          growth_stage?: string | null
          hiring_signals?: string | null
          id?: string
          industries?: string | null
          name?: string
          org_id?: string | null
          segment_id?: string | null
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
      knowledge_docs: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
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
      meetings: {
        Row: {
          account_id: string | null
          agenda: string | null
          ai_brief: string | null
          attendees: string | null
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
      messaging_pillars: {
        Row: {
          created_at: string
          created_by: string | null
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
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
          created_at: string
          created_by: string | null
          currency: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name?: string
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
      positioning: {
        Row: {
          alternatives: string | null
          best_customers: string | null
          category: string | null
          competitive_alternative: string | null
          created_at: string
          created_by: string | null
          differentiation: string | null
          differentiator: string | null
          elevator_pitch: string | null
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
          created_at?: string
          created_by?: string | null
          differentiation?: string | null
          differentiator?: string | null
          elevator_pitch?: string | null
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
          created_at?: string
          created_by?: string | null
          differentiation?: string | null
          differentiator?: string | null
          elevator_pitch?: string | null
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
          gross_margin_pct: number | null
          id: string
          motion: string
          name: string
          notes: string | null
          org_id: string | null
          payback_months: number | null
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
          gross_margin_pct?: number | null
          id?: string
          motion?: string
          name: string
          notes?: string | null
          org_id?: string | null
          payback_months?: number | null
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
          gross_margin_pct?: number | null
          id?: string
          motion?: string
          name?: string
          notes?: string | null
          org_id?: string | null
          payback_months?: number | null
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
      create_organization: { Args: { _name: string }; Returns: string }
      current_org: { Args: never; Returns: string }
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
      is_org_member: { Args: { _org: string }; Returns: boolean }
      shares_org: { Args: { _user: string }; Returns: boolean }
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
