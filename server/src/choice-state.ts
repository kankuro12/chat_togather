// Shared by pending counts and delivery checks; viewing does not answer a choice.
export const pendingChoiceCondition=`(
  (d.mode='choose' AND NOT EXISTS(SELECT 1 FROM decision_votes v WHERE v.decision_id=d.id AND v.user_id=?))
  OR (d.mode='rate' AND EXISTS(SELECT 1 FROM decision_options o WHERE o.decision_id=d.id AND NOT EXISTS(SELECT 1 FROM decision_votes v WHERE v.decision_id=d.id AND v.option_id=o.id AND v.user_id=?)))
)`;
