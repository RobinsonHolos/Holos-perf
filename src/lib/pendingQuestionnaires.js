/**
 * Calcule les questionnaires « à remplir » pour un athlète à un instant donné.
 * Logique pure (sans I/O) — miroir de l'affichage de AthleteHome, réutilisable/testable.
 *
 * Un questionnaire de séance est en attente si la séance du jour est terminée,
 * a un questionnaire lié, et n'a pas encore de réponse.
 * À défaut de séance avec questionnaire, le questionnaire quotidien est en attente
 * s'il est assigné et non répondu aujourd'hui.
 */

function isEventFinished(event, now) {
  if (event.end_time) {
    return now > new Date(`${event.event_date}T${event.end_time}`);
  }
  if (event.duration_minutes && event.start_time) {
    const startMs = new Date(`${event.event_date}T${event.start_time}`).getTime();
    return now.getTime() > startMs + event.duration_minutes * 60000;
  }
  return new Date(event.event_date) < now;
}

/**
 * @returns {Array<{type:'session'|'daily', templateId:string, eventId:string|null, name:string}>}
 */
export function getPendingQuestionnaires({
  todayEvents = [],
  assignedQuestionnaires = [],
  todayResponses = [],
  allResponses = [],
  now = new Date(),
} = {}) {
  const pending = [];

  // Questionnaires liés aux séances du jour terminées
  for (const event of todayEvents) {
    const templateId = event.questionnaire_template_id;
    if (!templateId) continue;
    if (!isEventFinished(event, now)) continue;
    const alreadyAnswered = allResponses.some((r) => r.event_id === event.id);
    if (alreadyAnswered) continue;
    const template = assignedQuestionnaires.find((q) => q.id === templateId);
    pending.push({
      type: 'session',
      templateId,
      eventId: event.id,
      name: template?.name || event.title || 'Questionnaire',
    });
  }

  // Questionnaire quotidien (uniquement si aucune séance du jour n'a de questionnaire)
  const hasEventQuestionnaire = todayEvents.some((e) => !!e.questionnaire_template_id);
  if (!hasEventQuestionnaire && assignedQuestionnaires.length > 0) {
    const daily = assignedQuestionnaires[0];
    const answered = todayResponses.some((r) => r.template_id === daily.id && !r.event_id);
    if (!answered) {
      pending.push({
        type: 'daily',
        templateId: daily.id,
        eventId: null,
        name: daily.name || 'Questionnaire quotidien',
      });
    }
  }

  return pending;
}
