DROP POLICY IF EXISTS "analysts_view_fairness" ON fairness_metrics;
CREATE POLICY "analysts_view_fairness"
  ON fairness_metrics FOR SELECT
  USING (is_analyst() OR is_admin());

DROP POLICY IF EXISTS "analysts_view_bias_reports" ON bias_reports;
CREATE POLICY "analysts_view_bias_reports"
  ON bias_reports FOR SELECT
  USING (is_analyst() OR is_admin());

DROP POLICY IF EXISTS "analysts_view_constraints" ON ethical_constraints;
CREATE POLICY "analysts_view_constraints"
  ON ethical_constraints FOR SELECT
  USING (is_analyst() OR is_admin());
