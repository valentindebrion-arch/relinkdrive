/**
 * Modèle d'affichage du suivi client.
 *
 * Aucun moteur de suivi n'est créé ici : ce module traduit uniquement les statuts
 * existants (`ride_status`) en libellés, descriptions et prochaine étape attendue.
 * ReLink n'est jamais présenté comme l'opérateur de la course : les statuts sont
 * toujours attribués au chauffeur ou décrivent factuellement la demande.
 */

export type TrackingStepKey =
  "requested" | "waiting" | "accepted" | "enroute" | "arrived" | "onboard" | "done";

export type TrackingStep = {
  key: TrackingStepKey;
  title: string;
  /** Décrit la situation, uniquement affiché pour l'étape active. */
  hint: string;
  match: string[];
};

export const TRACKING_STEPS: TrackingStep[] = [
  {
    key: "requested",
    title: "Demande envoyée",
    hint: "Votre demande a été envoyée à votre chauffeur.",
    match: ["new"],
  },
  {
    key: "waiting",
    title: "En attente de la réponse",
    hint: "Votre chauffeur consulte votre demande.",
    match: ["reviewing", "proposal_sent", "awaiting_client"],
  },
  {
    key: "accepted",
    title: "Demande acceptée",
    hint: "Votre chauffeur a accepté la demande.",
    match: ["confirmed"],
  },
  {
    key: "enroute",
    title: "Chauffeur en route",
    hint: "Votre chauffeur indique être en route vers le point de prise en charge.",
    match: ["driver_enroute"],
  },
  {
    key: "arrived",
    title: "Chauffeur arrivé",
    hint: "Votre chauffeur indique être arrivé au point de rendez-vous.",
    match: ["driver_arrived"],
  },
  {
    key: "onboard",
    title: "Course en cours",
    hint: "Votre chauffeur a déclaré la prise en charge.",
    match: ["client_onboard", "in_progress"],
  },
  {
    key: "done",
    title: "Course terminée",
    hint: "Course déclarée comme terminée par votre chauffeur.",
    match: ["completed"],
  },
];

/** Étapes suivantes annoncées, sans jamais anticiper une action du chauffeur. */
const NEXT_HINT: Record<TrackingStepKey, string | null> = {
  requested: "Votre chauffeur va étudier la demande.",
  waiting: "Votre chauffeur indiquera s'il accepte la demande.",
  accepted: "Votre chauffeur indiquera son départ.",
  enroute: "Votre chauffeur indiquera son arrivée sur place.",
  arrived: "Votre chauffeur déclarera la prise en charge.",
  onboard: "Votre chauffeur déclarera la fin de la course.",
  done: null,
};

export const CANCELLABLE_STATUSES = ["new", "reviewing", "proposal_sent", "awaiting_client"];

export type TrackingTone = "neutral" | "progress" | "success" | "stopped";

export type TrackingPresentation = {
  /** Index de l'étape courante dans TRACKING_STEPS (-1 si hors parcours). */
  index: number;
  title: string;
  description: string;
  next: string | null;
  tone: TrackingTone;
  /** Vrai pour les fins de parcours qui ne mènent pas à une course réalisée. */
  stopped: boolean;
};

export function trackingStepIndex(status: string) {
  return TRACKING_STEPS.findIndex((s) => s.match.includes(status));
}

export function trackingPresentation(
  status: string,
  opts: { driverName?: string; cancelledByDriver?: boolean } = {},
): TrackingPresentation {
  const driver = opts.driverName?.trim() || "votre chauffeur";

  if (status === "refused") {
    return {
      index: -1,
      title: "Demande refusée",
      description: `${driver} n'est pas disponible pour cette demande.`,
      next: "Vous pouvez envoyer une nouvelle demande, au même chauffeur ou à un autre.",
      tone: "stopped",
      stopped: true,
    };
  }
  if (status === "expired") {
    return {
      index: -1,
      title: "Demande expirée",
      description: `${driver} n'a pas répondu dans le délai de 10 minutes.`,
      next: "Vous pouvez relancer une demande.",
      tone: "stopped",
      stopped: true,
    };
  }
  if (status === "cancelled") {
    return {
      index: -1,
      title: opts.cancelledByDriver ? "Réservation annulée par le chauffeur" : "Demande annulée",
      description: opts.cancelledByDriver
        ? `${driver} a annulé cette réservation.`
        : "Cette demande a été annulée.",
      next: null,
      tone: "stopped",
      stopped: true,
    };
  }

  const index = trackingStepIndex(status);
  const step = TRACKING_STEPS[index];
  if (!step) {
    return {
      index: -1,
      title: "Demande en préparation",
      description: "Cette demande n'a pas encore été envoyée à un chauffeur.",
      next: null,
      tone: "neutral",
      stopped: false,
    };
  }
  return {
    index,
    title: step.title,
    description: step.hint,
    next: NEXT_HINT[step.key],
    tone: step.key === "done" ? "success" : index >= 2 ? "progress" : "neutral",
    stopped: false,
  };
}
