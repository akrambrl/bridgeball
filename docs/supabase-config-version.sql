-- ============================================================================
--  VERSION MINIMALE DE L'APP NATIVE (mise à jour obligatoire ou conseillée)
--  ---------------------------------------------------------------------------
--  À jouer une fois dans l'éditeur SQL de Supabase. Idempotent : rejouable.
--
--  Une petite table de configuration, lisible par l'app, modifiable seulement
--  depuis le tableau de bord. L'app (src/lib/version.ts) y lit la ligne
--  `version_min` au lancement, au retour dans l'app, puis toutes les 30 minutes.
--
--  Les seuils sont des NUMÉROS DE BUILD (CFBundleVersion sur iOS, versionCode sur
--  Android — les workflows y mettent le numéro d'exécution : voir le nom du
--  fichier .ipa / le « versionCode » affiché par le workflow Android).
--    • `obligatoire` : en dessous, l'app est BLOQUÉE derrière un écran « Mise à jour
--      obligatoire » qui renvoie vers le store ;
--    • `conseillee`  : en dessous, un bandeau « Nouvelle version disponible » qui se
--      ferme (et revient dans 24 h).
--  0 = pas de seuil. Au départ, tout est à 0 : RIEN n'est bloqué.
--
--  ⚠️ N'exige JAMAIS un build que les stores n'ont pas encore publié : tous les
--     joueurs seraient bloqués sans pouvoir se mettre à jour.
--  ⚠️ Seules les versions de l'app qui contiennent ce mécanisme le lisent. Les
--     versions plus anciennes ne seront jamais bloquées.
-- ============================================================================

create table if not exists public.bb_config (
  cle    text primary key,
  valeur jsonb not null,
  maj_le timestamptz not null default now()
);

alter table public.bb_config enable row level security;

-- Lecture pour l'app (les deux rôles : le jeton de session peut être celui d'authenticated).
-- AUCUNE politique d'écriture : seule la clé de service ou l'éditeur SQL modifie.
drop policy if exists p_bb_config_select on public.bb_config;
create policy p_bb_config_select on public.bb_config for select to anon, authenticated using (true);
revoke all on public.bb_config from anon, authenticated;
grant select on public.bb_config to anon, authenticated;

insert into public.bb_config (cle, valeur) values
  ('version_min', '{"ios": {"obligatoire": 0, "conseillee": 0}, "android": {"obligatoire": 0, "conseillee": 0}}')
on conflict (cle) do nothing;

-- ─── POUR S'EN SERVIR ───────────────────────────────────────────────────────
--
--  Conseiller la mise à jour aux iPhone dont le build est inférieur à 42 :
--    update public.bb_config
--       set valeur = jsonb_set(valeur, '{ios,conseillee}', '42'), maj_le = now()
--     where cle = 'version_min';
--
--  L'IMPOSER aux Android dont le versionCode est inférieur à 30 :
--    update public.bb_config
--       set valeur = jsonb_set(valeur, '{android,obligatoire}', '30'), maj_le = now()
--     where cle = 'version_min';
--
--  Tout débloquer d'un coup (en cas d'erreur) :
--    update public.bb_config
--       set valeur = '{"ios": {"obligatoire": 0, "conseillee": 0}, "android": {"obligatoire": 0, "conseillee": 0}}',
--           maj_le = now()
--     where cle = 'version_min';
