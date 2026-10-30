// Generated from migration SQL PostgreSQL catalog. Regenerate: npm run db:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      content_public: { Args: { p_id?: string | null }; Returns: Json };
      enquire: { Args: { p_payload: Json }; Returns: Json };
      portal: {
        Args: { p_action: string; p_workspace?: string | null; p_payload?: Json };
        Returns: Json;
      };
      schema_version: { Args: {}; Returns: number };
    };
  };
};
