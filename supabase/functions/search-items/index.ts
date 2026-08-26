// Natural-language search over the caller's whole equipment catalog. Text only (no photos sent
// to the model here — cheap even with hundreds of items) so Claude can reason about matches,
// including technical compatibility (e.g. "19V 3A power supply" matching a slightly different
// but compatible spec), not just keyword overlap. Runs with the caller's own JWT so RLS scopes
// the catalog to their own rows.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.120.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const MODEL = "claude-sonnet-5";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Plain JSON Schema (not Zod) — see the note in analyze-item/index.ts: structured outputs
// require additionalProperties:false on every object, which the Zod helper didn't handle
// cleanly for this app's schemas.
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      description: "0 à 6 objets les plus pertinents, triés du meilleur au moins bon.",
      items: {
        type: "object",
        properties: {
          item_id: { type: "string" },
          confiance: { type: "string", enum: ["haute", "moyenne", "faible"] },
          raison: { type: "string", description: "Justification brève (une phrase) de la pertinence de cet objet." },
        },
        required: ["item_id", "confiance", "raison"],
        additionalProperties: false,
      },
    },
  },
  required: ["matches"],
  additionalProperties: false,
};

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

    const response = await anthropic.messages.create({
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
      output_config: { format: { type: "json_schema", schema: RESULT_SCHEMA } },
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) return jsonResponse({ matches: [] });

    const parsed = JSON.parse(textBlock.text) as {
      matches: { item_id: string; confiance: string; raison: string }[];
    };
    return jsonResponse({ matches: parsed.matches });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 502);
  }
});
