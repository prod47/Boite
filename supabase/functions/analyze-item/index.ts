// Given an item's photos + the user's quick label, asks Claude to write a fuller description,
// pick a category, and extract any technical specs visible on a label/plate in the photos
// (voltage, amperage, connector type, brand...). Runs with the caller's own JWT (not the service
// role) so Postgres RLS and the storage bucket policy both do the authorization for us — this
// function only ever sees rows/photos the caller already owns.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.120.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@0.120.0/helpers/zod";
import { z } from "npm:zod@3";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

// The app is served from a static host (GitHub Pages), a different origin than this function,
// so every response needs these to be readable client-side.
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

const MODEL = "claude-sonnet-5";
const PHOTO_BUCKET = "materiel-photos";

const AnalysisSchema = z.object({
  description: z.string().describe(
    "Description utile en français (1 à 3 phrases) : ce que c'est, à quoi ça sert, état apparent."
  ),
  category: z.string().describe(
    "Catégorie courte en français, ex: caméra, objectif, éclairage, alimentation, câble, support/bras, " +
    "trépied, audio, accessoire, quincaillerie, informatique, autre."
  ),
  specs: z.record(z.string()).describe(
    "Caractéristiques techniques clé/valeur, en français, uniquement celles clairement lisibles sur une " +
    "étiquette/plaque ou certaines (ex: tension, ampérage, connecteur, marque, modèle, dimensions, poids). " +
    "Objet vide si rien n'est identifiable — ne rien inventer."
  ),
});

const SYSTEM_PROMPT =
  "Tu aides à cataloguer du matériel de tournage et de studio TV (caméras, objectifs, éclairage, pieds, " +
  "bras, alimentations, câbles, accessoires, quincaillerie...). On te donne une ou plusieurs photos d'un " +
  "même objet et une courte note écrite par l'utilisateur. Réponds en français. N'invente aucune " +
  "caractéristique technique qui ne serait pas clairement visible ou mentionnée.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  let supabase;
  let itemId: string;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "missing authorization" }, 401);

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json();
    itemId = body.item_id;
    if (!itemId) return jsonResponse({ error: "item_id required" }, 400);
  } catch {
    return jsonResponse({ error: "invalid request body" }, 400);
  }

  const { data: item, error: itemErr } = await supabase
    .from("materiel_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (itemErr || !item) return jsonResponse({ error: "item not found" }, 404);
  if (!item.photo_paths || item.photo_paths.length === 0) {
    return jsonResponse({ error: "no photos on this item" }, 400);
  }

  const imageBlocks: { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }[] = [];
  for (const path of item.photo_paths as string[]) {
    const { data: blob, error: dlErr } = await supabase.storage.from(PHOTO_BUCKET).download(path);
    if (dlErr || !blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    imageBlocks.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: encodeBase64(bytes) },
    });
  }

  if (imageBlocks.length === 0) {
    await supabase.from("materiel_items").update({
      status: "error",
      analysis_error: "impossible de télécharger les photos",
    }).eq("id", itemId);
    return jsonResponse({ error: "could not download any photos" }, 500);
  }

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text:
                `Note rapide donnée par l'utilisateur : "${item.label || "(aucune)"}"\n\n` +
                "Analyse ces photos et remplis les champs demandés.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(AnalysisSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      await supabase.from("materiel_items").update({
        status: "error",
        analysis_error: "réponse IA non exploitable",
      }).eq("id", itemId);
      return jsonResponse({ error: "parsing failed" }, 502);
    }

    await supabase.from("materiel_items").update({
      description: parsed.description,
      category: parsed.category,
      specs: parsed.specs,
      status: "analyzed",
      analysis_error: null,
    }).eq("id", itemId);

    return jsonResponse({ ok: true, ...parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("materiel_items").update({
      status: "error",
      analysis_error: message.slice(0, 500),
    }).eq("id", itemId);
    return jsonResponse({ error: message }, 502);
  }
});
