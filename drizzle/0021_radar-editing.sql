-- Lock the radar before replacing keywords so concurrent edits cannot mix filters.
CREATE FUNCTION update_radar(p_id uuid,p_actor text,p_workspace uuid,p_name text,p_excluded jsonb,p_industries jsonb,p_sources jsonb,p_languages jsonb,p_threshold integer,p_frequency text,p_keywords jsonb) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_radar radars%ROWTYPE;
BEGIN
 IF p_workspace IS NOT NULL THEN
  -- Use the same team lock as membership and workspace creation mutations.
  PERFORM 1 FROM teams WHERE id=(SELECT team_id FROM workspaces WHERE id=p_workspace) FOR UPDATE;
 END IF;
 SELECT * INTO v_radar FROM radars WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_radar.workspace_id IS DISTINCT FROM p_workspace THEN RETURN null; END IF;
 IF v_radar.workspace_id IS NULL THEN
  IF v_radar.user_id <> p_actor THEN RETURN null; END IF;
 ELSE
  IF coalesce(workspace_role(v_radar.workspace_id,p_actor),'') NOT IN ('admin','editor') THEN RETURN null; END IF;
 END IF;
 UPDATE radars SET name=p_name,excluded_words=p_excluded,industries=p_industries,sources=p_sources,languages=p_languages,alert_threshold=p_threshold,frequency=p_frequency WHERE id=p_id;
 DELETE FROM radar_keywords WHERE radar_id=p_id;
 INSERT INTO radar_keywords(radar_id,keyword) SELECT p_id,value FROM jsonb_array_elements_text(p_keywords) ON CONFLICT DO NOTHING;
 INSERT INTO audit_logs(user_id,action,metadata) VALUES(p_actor,'radar.updated',jsonb_build_object('radarId',p_id,'workspaceId',v_radar.workspace_id));
 RETURN p_id;
END $$;
