


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."session_role" AS ENUM (
    'initiator',
    'challenger'
);


ALTER TYPE "public"."session_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."game_sessions" (
    "session_id" "text" NOT NULL,
    "state" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."game_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_memberships" (
    "session_id" "text" NOT NULL,
    "device_id" "text" NOT NULL,
    "archived_at" timestamp with time zone,
    "last_opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "public"."session_role" NOT NULL
);


ALTER TABLE "public"."session_memberships" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."open_game_sessions" AS
 SELECT "session_id",
    "state",
    "created_at",
    "updated_at"
   FROM "public"."game_sessions" "s"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."session_memberships" "m"
          WHERE (("m"."session_id" = "s"."session_id") AND (("m"."role" = 'challenger'::"public"."session_role") OR ("m"."archived_at" IS NOT NULL))))));


ALTER VIEW "public"."open_game_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_profiles" (
    "device_id" "text" NOT NULL,
    "player_name" "text" NOT NULL,
    "avatar_id" "text" DEFAULT 'char01'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."player_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_chat_messages" (
    "id" "text" NOT NULL,
    "session_id" "text" NOT NULL,
    "player_id" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "text" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_chat_messages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."unarchived_game_sessions" AS
 SELECT "session_id",
    "state",
    "created_at",
    "updated_at"
   FROM "public"."game_sessions" "s"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."session_memberships" "m"
          WHERE (("m"."session_id" = "s"."session_id") AND ("m"."archived_at" IS NOT NULL)))));


ALTER VIEW "public"."unarchived_game_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."game_sessions"
    ADD CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "public"."player_profiles"
    ADD CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("device_id");



ALTER TABLE ONLY "public"."session_chat_messages"
    ADD CONSTRAINT "session_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_memberships"
    ADD CONSTRAINT "session_memberships_pkey" PRIMARY KEY ("session_id", "role");



CREATE OR REPLACE TRIGGER "trg_touch_game_sessions" BEFORE UPDATE ON "public"."game_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_player_profiles" BEFORE UPDATE ON "public"."player_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_session_chat_messages" BEFORE UPDATE ON "public"."session_chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_session_memberships" BEFORE UPDATE ON "public"."session_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."session_chat_messages"
    ADD CONSTRAINT "session_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("session_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_memberships"
    ADD CONSTRAINT "session_memberships_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."player_profiles"("device_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_memberships"
    ADD CONSTRAINT "session_memberships_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("session_id") ON DELETE CASCADE;



ALTER TABLE "public"."game_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public insert player profiles" ON "public"."player_profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "public insert session chat messages" ON "public"."session_chat_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "public insert session memberships" ON "public"."session_memberships" FOR INSERT WITH CHECK (true);



CREATE POLICY "public insert sessions" ON "public"."game_sessions" FOR INSERT WITH CHECK (true);



CREATE POLICY "public read player profiles" ON "public"."player_profiles" FOR SELECT USING (true);



CREATE POLICY "public read session chat messages" ON "public"."session_chat_messages" FOR SELECT USING (true);



CREATE POLICY "public read session memberships" ON "public"."session_memberships" FOR SELECT USING (true);



CREATE POLICY "public read sessions" ON "public"."game_sessions" FOR SELECT USING (true);



CREATE POLICY "public update player profiles" ON "public"."player_profiles" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "public update session chat messages" ON "public"."session_chat_messages" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "public update session memberships" ON "public"."session_memberships" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "public update sessions" ON "public"."game_sessions" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."session_chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_memberships" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."game_sessions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."player_profiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."session_chat_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."session_memberships";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."game_sessions" TO "anon";
GRANT ALL ON TABLE "public"."game_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."game_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."session_memberships" TO "anon";
GRANT ALL ON TABLE "public"."session_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."session_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."open_game_sessions" TO "anon";
GRANT ALL ON TABLE "public"."open_game_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."open_game_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."player_profiles" TO "anon";
GRANT ALL ON TABLE "public"."player_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."player_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."session_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."session_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."session_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."unarchived_game_sessions" TO "anon";
GRANT ALL ON TABLE "public"."unarchived_game_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."unarchived_game_sessions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































