CREATE FUNCTION agency_active(p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM subscriptions WHERE user_id=p_user AND plan='agency' AND status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end>now()))
$$;
--> statement-breakpoint
CREATE FUNCTION team_role(p_team uuid,p_user text) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN t.owner_id=p_user THEN 'owner' ELSE m.role END FROM teams t LEFT JOIN team_members m ON m.team_id=t.id AND m.user_id=p_user WHERE t.id=p_team AND agency_active(t.owner_id) AND (t.owner_id=p_user OR m.user_id IS NOT NULL)
$$;
--> statement-breakpoint
CREATE FUNCTION workspace_role(p_workspace uuid,p_user text) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN t.owner_id=p_user OR tm.role='admin' THEN 'admin' ELSE wm.role END FROM workspaces w JOIN teams t ON t.id=w.team_id LEFT JOIN team_members tm ON tm.team_id=t.id AND tm.user_id=p_user LEFT JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=p_user WHERE w.id=p_workspace AND agency_active(t.owner_id) AND (t.owner_id=p_user OR tm.role='admin' OR wm.user_id IS NOT NULL)
$$;
--> statement-breakpoint
ALTER TABLE team_members ADD CONSTRAINT team_member_role CHECK(role IN ('admin','member'));
--> statement-breakpoint
ALTER TABLE team_invites ADD CONSTRAINT invite_role CHECK(role IN ('admin','member'));
--> statement-breakpoint
ALTER TABLE workspace_members ADD CONSTRAINT workspace_member_role CHECK(role IN ('editor','viewer'));
--> statement-breakpoint
ALTER TABLE watchlists ADD CONSTRAINT watchlist_scope CHECK ((user_id IS NOT NULL AND workspace_id IS NULL) OR (user_id IS NULL AND workspace_id IS NOT NULL));
--> statement-breakpoint
CREATE FUNCTION create_agency_team(p_id uuid,p_actor text,p_name text) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM users WHERE id=p_actor FOR UPDATE;
 IF NOT agency_active(p_actor) OR EXISTS(SELECT 1 FROM teams WHERE owner_id=p_actor) THEN RETURN null; END IF;
 INSERT INTO teams(id,owner_id,name) VALUES(p_id,p_actor,p_name);
 INSERT INTO team_members(team_id,user_id,role) VALUES(p_id,p_actor,'admin');
 INSERT INTO audit_logs(user_id,action,metadata) VALUES(p_actor,'team.created',jsonb_build_object('teamId',p_id));
 RETURN p_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION create_client_workspace(p_id uuid,p_team uuid,p_actor text,p_name text,p_client text,p_brand text,p_color text) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM teams WHERE id=p_team FOR UPDATE;
 IF team_role(p_team,p_actor) IS NULL OR team_role(p_team,p_actor) NOT IN ('owner','admin') THEN RETURN null; END IF;
 IF (SELECT count(*) FROM workspaces WHERE team_id=p_team)>=100 THEN RETURN null; END IF;
 INSERT INTO workspaces(id,team_id,name,client_name,brand_name,brand_color) VALUES(p_id,p_team,p_name,p_client,p_brand,p_color);
 INSERT INTO watchlists(workspace_id,name) VALUES(p_id,'Workspace watchlist');
 INSERT INTO audit_logs(user_id,action,metadata) VALUES(p_actor,'workspace.created',jsonb_build_object('workspaceId',p_id));
 RETURN p_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION manage_team_member(p_team uuid,p_actor text,p_target text,p_action text,p_role text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE a text; target_role text; owner_user text;
BEGIN
 SELECT owner_id INTO owner_user FROM teams WHERE id=p_team FOR UPDATE;
 a=team_role(p_team,p_actor);
 SELECT role INTO target_role FROM team_members WHERE team_id=p_team AND user_id=p_target;
 IF a IS NULL OR a NOT IN ('owner','admin') OR target_role IS NULL OR owner_user=p_target THEN RETURN false; END IF;
 IF a<>'owner' AND (target_role='admin' OR p_role='admin') THEN RETURN false; END IF;
 IF p_action='remove' THEN
  DELETE FROM team_members WHERE team_id=p_team AND user_id=p_target;
  UPDATE api_keys SET revoked_at=now() WHERE user_id=p_target AND workspace_id IN (SELECT id FROM workspaces WHERE team_id=p_team);
 ELSIF p_action='role' AND p_role IN ('admin','member') THEN
  UPDATE team_members SET role=p_role WHERE team_id=p_team AND user_id=p_target;
 ELSE RETURN false; END IF;
 INSERT INTO audit_logs(user_id,action,metadata) VALUES(p_actor,'team.member.'||p_action,jsonb_build_object('teamId',p_team,'targetUserId',p_target,'role',p_role));
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION set_workspace_member(p_workspace uuid,p_actor text,p_target text,p_role text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_team uuid;
BEGIN
 SELECT team_id INTO v_team FROM workspaces WHERE id=p_workspace;
 PERFORM 1 FROM teams WHERE id=v_team FOR UPDATE;
 IF team_role(v_team,p_actor) IS NULL OR team_role(v_team,p_actor) NOT IN ('owner','admin') OR NOT EXISTS(SELECT 1 FROM team_members WHERE team_id=v_team AND user_id=p_target) THEN RETURN false; END IF;
 IF p_role='remove' THEN
  DELETE FROM workspace_members WHERE workspace_id=p_workspace AND user_id=p_target;
  UPDATE api_keys SET revoked_at=now() WHERE workspace_id=p_workspace AND user_id=p_target AND team_role(v_team,p_target)='member';
 ELSIF p_role IN ('editor','viewer') THEN
  INSERT INTO workspace_members(workspace_id,team_id,user_id,role) VALUES(p_workspace,v_team,p_target,p_role) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role;
 ELSE RETURN false; END IF;
 INSERT INTO audit_logs(user_id,action,metadata) VALUES(p_actor,'workspace.access.changed',jsonb_build_object('workspaceId',p_workspace,'targetUserId',p_target,'role',p_role));
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION create_team_invite(p_id uuid,p_team uuid,p_actor text,p_email text,p_role text,p_hash text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE a text;
BEGIN
 PERFORM 1 FROM teams WHERE id=p_team FOR UPDATE;
 a=team_role(p_team,p_actor);
 IF a IS NULL OR a NOT IN ('owner','admin') OR p_role NOT IN ('admin','member') OR (a<>'owner' AND p_role='admin') THEN RETURN null; END IF;
 IF (SELECT count(*) FROM team_members WHERE team_id=p_team)>=50 THEN RETURN null; END IF;
 INSERT INTO team_invites(id,team_id,email,role,token_hash,created_by,expires_at) VALUES(p_id,p_team,lower(p_email),p_role,p_hash,p_actor,now()+interval '7 days');
 INSERT INTO audit_logs(user_id,action,metadata) VALUES(p_actor,'team.invite.created',jsonb_build_object('teamId',p_team,'inviteId',p_id));
 RETURN p_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION accept_team_invite(p_hash text,p_actor text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_inv team_invites%ROWTYPE; v_email text; creator_role text;
BEGIN
 SELECT * INTO v_inv FROM team_invites WHERE token_hash=p_hash;
 IF NOT FOUND THEN RETURN null; END IF;
 PERFORM 1 FROM teams WHERE id=v_inv.team_id FOR UPDATE;
 SELECT * INTO v_inv FROM team_invites WHERE id=v_inv.id FOR UPDATE;
 SELECT lower(email) INTO v_email FROM users WHERE id=p_actor AND email_verified;
 creator_role=team_role(v_inv.team_id,v_inv.created_by);
 IF v_email IS NULL OR v_email<>v_inv.email OR v_inv.accepted_at IS NOT NULL OR v_inv.revoked_at IS NOT NULL OR v_inv.expires_at<=now() OR creator_role IS NULL OR creator_role NOT IN ('owner','admin') OR (v_inv.role='admin' AND creator_role<>'owner') OR (SELECT count(*) FROM team_members WHERE team_id=v_inv.team_id)>=50 THEN RETURN null; END IF;
 INSERT INTO team_members(team_id,user_id,role) VALUES(v_inv.team_id,p_actor,v_inv.role) ON CONFLICT DO NOTHING;
 UPDATE team_invites SET accepted_at=now() WHERE id=v_inv.id;
 INSERT INTO audit_logs(user_id,action,metadata) VALUES(p_actor,'team.invite.accepted',jsonb_build_object('teamId',v_inv.team_id));
 RETURN v_inv.team_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION create_workspace_radar_limited(p_id uuid,p_workspace uuid,p_actor text,p_name text,p_excluded jsonb,p_industries jsonb,p_sources jsonb,p_languages jsonb,p_threshold integer,p_frequency text,p_keywords jsonb) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_team uuid;
BEGIN
 SELECT team_id INTO v_team FROM workspaces WHERE id=p_workspace;
 PERFORM 1 FROM teams WHERE id=v_team FOR UPDATE;
 IF workspace_role(p_workspace,p_actor) IS NULL OR workspace_role(p_workspace,p_actor) NOT IN ('admin','editor') OR (SELECT count(*) FROM radars WHERE workspace_id=p_workspace)>=100 THEN RETURN null; END IF;
 INSERT INTO radars(id,user_id,workspace_id,name,excluded_words,industries,sources,languages,alert_threshold,frequency) VALUES(p_id,p_actor,p_workspace,p_name,p_excluded,p_industries,p_sources,p_languages,p_threshold,p_frequency);
 INSERT INTO radar_keywords(radar_id,keyword) SELECT p_id,value FROM jsonb_array_elements_text(p_keywords) ON CONFLICT DO NOTHING;
 RETURN p_id;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION create_radar_limited(p_id uuid,p_user text,p_name text,p_excluded jsonb,p_industries jsonb,p_sources jsonb,p_languages jsonb,p_threshold integer,p_frequency text,p_keywords jsonb,p_limit integer) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM users WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN null; END IF;
 IF (SELECT count(*) FROM radars WHERE user_id=p_user AND workspace_id IS NULL)>=p_limit THEN RETURN null; END IF;
 INSERT INTO radars(id,user_id,name,excluded_words,industries,sources,languages,alert_threshold,frequency) VALUES(p_id,p_user,p_name,p_excluded,p_industries,p_sources,p_languages,p_threshold,p_frequency);
 INSERT INTO radar_keywords(radar_id,keyword) SELECT p_id,value FROM jsonb_array_elements_text(p_keywords) ON CONFLICT DO NOTHING;
 RETURN p_id;
END $$;

--> statement-breakpoint
CREATE FUNCTION mutate_workspace_watchlist(p_workspace uuid,p_actor text,p_opportunity uuid,p_add boolean) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_team uuid; v_list uuid;
BEGIN
 SELECT team_id INTO v_team FROM workspaces WHERE id=p_workspace;
 PERFORM 1 FROM teams WHERE id=v_team FOR UPDATE;
 IF workspace_role(p_workspace,p_actor) IS NULL OR workspace_role(p_workspace,p_actor) NOT IN ('admin','editor') THEN RETURN false; END IF;
 SELECT id INTO v_list FROM watchlists WHERE workspace_id=p_workspace;
 IF v_list IS NULL THEN RETURN false; END IF;
 IF p_add THEN INSERT INTO watchlist_items(watchlist_id,opportunity_id) VALUES(v_list,p_opportunity) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM watchlist_items WHERE watchlist_id=v_list AND opportunity_id=p_opportunity; END IF;
 INSERT INTO audit_logs(user_id,action,metadata) VALUES(p_actor,'workspace.watchlist.changed',jsonb_build_object('workspaceId',p_workspace,'opportunityId',p_opportunity,'saved',p_add));
 RETURN true;
END $$;
