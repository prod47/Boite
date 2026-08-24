// Natural-language search over the caller's whole equipment catalog. Text only (no photos sent
// to the model here — cheap even with hundreds of items) so Claude can reason about matches,
// including technical compatibility (e.g. "19V 3A power supply" matching a slightly different
// but compatible spec), not just keyword overlap. Runs with the caller's own JWT so RLS scopes
// the catalog to their own rows.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.120.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@0.120.0/helpers/zod";
import { z } from "npm:zod@3";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const MODEL = "claude-sonnet-5";

const ResultSchema = z.object({
  matches: z.array(
    z.object({
      item_id: z.string(),
      confiance: z.enum(["haute", "moyenne", "faible"]),
      raison: z.string().describe("Justification brève (une phrase) de la pertinence de cet objet."),
    })
  ).describe("0 à 6 objets les plus pertinents, triés du meilleur au moins bon."),
});

const SYSTEM_PROMPT =
  "Tu aides à retrouver du matériel de tournage/studio TV dans un inventaire. On te donne la liste " +
  "complète des objets de l'utilisateur (nom, catégorie, emplacement, description, caractéristiques " +
  "techniques) au format JSON, et une demande en langage naturel. Propose les objets les plus " +
  "pertinents, y compris par compatibilité technique quand la demande porte sur une spec (une " +
  "alimentation ou un câble dont les valeurs sont proches ou compatibles compte comme pertinent, même " +
  "sans correspondance exacte). Réponds en français. Si rien ne correspond, renvoie une liste vide.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  let supabase;
  let query: string;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "missing authorization" }, 401);

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json();
    query = (body.query || "").trim();
    if (!query) return jsonResponse({ error: "query required" }, 400);
  } catch {
    return jsonResponse({ error: "invalid request body" }, 400);
  }

  const { data: items, error } = await supabase
    .from("materiel_items")
    .select("id, label, description, category, specs, location");

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!items || items.length === 0) return jsonResponse({ matches: [] });

  const catalog = items.map((it) => ({
    id: it.id,
    nom: it.label,
    categorie: it.category,
    emplacement: it.location,
    description: it.description,
    caracteristiques: it.specs,
  }));

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Inventaire (JSON) :\n${JSON.stringify(catalog)}\n\n` +
            `Demande de l'utilisateur : "${query}"`,
        },
      ],
      output_config: { format: zodOutputFormat(ResultSchema) },
    });

    const parsed = response.parsed_output;
    return jsonResponse({ matches: parsed ? parsed.matches : [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 502);
  }
});
