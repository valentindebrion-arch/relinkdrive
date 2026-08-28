/**
 * Départements français : le secteur géographique de référence de ReLink.
 * Le code postal n'est jamais utilisé tel quel comme secteur, il est toujours
 * ramené à son code département (63170 → 63).
 */

export const DEPARTMENT_NAMES: Record<string, string> = {
  "01": "Ain",
  "02": "Aisne",
  "03": "Allier",
  "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes",
  "06": "Alpes-Maritimes",
  "07": "Ardèche",
  "08": "Ardennes",
  "09": "Ariège",
  "10": "Aube",
  "11": "Aude",
  "12": "Aveyron",
  "13": "Bouches-du-Rhône",
  "14": "Calvados",
  "15": "Cantal",
  "16": "Charente",
  "17": "Charente-Maritime",
  "18": "Cher",
  "19": "Corrèze",
  "2A": "Corse-du-Sud",
  "2B": "Haute-Corse",
  "21": "Côte-d'Or",
  "22": "Côtes-d'Armor",
  "23": "Creuse",
  "24": "Dordogne",
  "25": "Doubs",
  "26": "Drôme",
  "27": "Eure",
  "28": "Eure-et-Loir",
  "29": "Finistère",
  "30": "Gard",
  "31": "Haute-Garonne",
  "32": "Gers",
  "33": "Gironde",
  "34": "Hérault",
  "35": "Ille-et-Vilaine",
  "36": "Indre",
  "37": "Indre-et-Loire",
  "38": "Isère",
  "39": "Jura",
  "40": "Landes",
  "41": "Loir-et-Cher",
  "42": "Loire",
  "43": "Haute-Loire",
  "44": "Loire-Atlantique",
  "45": "Loiret",
  "46": "Lot",
  "47": "Lot-et-Garonne",
  "48": "Lozère",
  "49": "Maine-et-Loire",
  "50": "Manche",
  "51": "Marne",
  "52": "Haute-Marne",
  "53": "Mayenne",
  "54": "Meurthe-et-Moselle",
  "55": "Meuse",
  "56": "Morbihan",
  "57": "Moselle",
  "58": "Nièvre",
  "59": "Nord",
  "60": "Oise",
  "61": "Orne",
  "62": "Pas-de-Calais",
  "63": "Puy-de-Dôme",
  "64": "Pyrénées-Atlantiques",
  "65": "Hautes-Pyrénées",
  "66": "Pyrénées-Orientales",
  "67": "Bas-Rhin",
  "68": "Haut-Rhin",
  "69": "Rhône",
  "70": "Haute-Saône",
  "71": "Saône-et-Loire",
  "72": "Sarthe",
  "73": "Savoie",
  "74": "Haute-Savoie",
  "75": "Paris",
  "76": "Seine-Maritime",
  "77": "Seine-et-Marne",
  "78": "Yvelines",
  "79": "Deux-Sèvres",
  "80": "Somme",
  "81": "Tarn",
  "82": "Tarn-et-Garonne",
  "83": "Var",
  "84": "Vaucluse",
  "85": "Vendée",
  "86": "Vienne",
  "87": "Haute-Vienne",
  "88": "Vosges",
  "89": "Yonne",
  "90": "Territoire de Belfort",
  "91": "Essonne",
  "92": "Hauts-de-Seine",
  "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne",
  "95": "Val-d'Oise",
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
};

/** Code département d'un code postal (63170 → « 63 », 20250 → « 2B »). */
export function departmentFromPostcode(postcode: string | null | undefined): string | null {
  const pc = (postcode ?? "").trim();
  if (!/^\d{5}$/.test(pc)) return null;
  const two = pc.slice(0, 2);
  if (two === "97" || two === "98") return pc.slice(0, 3);
  if (two === "20") return Number(pc.slice(0, 3)) <= 201 ? "2A" : "2B";
  return two;
}

/**
 * Code département d'un texte libre : code seul (« 63 », « 2A »), code postal,
 * ou libellé contenant l'un des deux (« Puy-de-Dôme (63) », « 63170 Aubière »).
 */
export function departmentFromText(value: string | null | undefined): string | null {
  const t = (value ?? "").trim().toUpperCase();
  if (!t) return null;
  if (/^(2A|2B)$/.test(t)) return t;
  if (/^(97|98)\d$/.test(t)) return t;
  if (/^\d{2}$/.test(t) && t !== "00") return t;
  if (/^\d{5}$/.test(t)) return departmentFromPostcode(t);
  const postcode = t.match(/\b\d{5}\b/);
  if (postcode) return departmentFromPostcode(postcode[0]);
  const code = t.match(/\b(2A|2B|9[78]\d|\d{2})\b/);
  if (code) return departmentFromText(code[1]);
  // Dernier recours : nom du département écrit en toutes lettres.
  const norm = normalizeName(t);
  for (const [dep, name] of Object.entries(DEPARTMENT_NAMES)) {
    if (normalizeName(name) === norm) return dep;
  }
  return null;
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function departmentName(code: string | null | undefined): string | null {
  if (!code) return null;
  return DEPARTMENT_NAMES[code] ?? null;
}

/** Libellé affiché dans l'interface : « Puy-de-Dôme (63) ». */
export function departmentLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const name = departmentName(code);
  return name ? `${name} (${code})` : `Département ${code}`;
}
