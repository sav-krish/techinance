/**
 * Issues a course completion certificate.
 *
 * The previous version of this function trusted its request body: it took
 * `userId`, `studentName` and `studentEmail` straight from the JSON and never
 * looked at the Authorization header. With permissive CORS that made it an open
 * endpoint. Anyone could mint a certificate in any name, have it emailed
 * anywhere, and write a row attributed to any account using the service-role
 * key. It also never checked that the learner had finished anything.
 *
 * So this version establishes two things before generating anything:
 *
 *   1. WHO is asking. The caller's access token is verified against Supabase
 *      Auth, and the user id and email come from that token, never the body.
 *   2. WHETHER THEY FINISHED. Every episode the course requires must be marked
 *      complete in `episode_progress` for that user, read server-side.
 *
 * What this does not solve: `episode_progress` is still written by the browser,
 * so a determined learner can mark episodes complete without playing them.
 * Closing that needs the scene graph to run server-side, which is a much larger
 * change. This does close the hole where no play was needed at all, and it means
 * forging a certificate now requires forging progress under your own account.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { COURSE_TEMPLATES_BASE64 } from "./template-base64.ts";
import { COURSE_REQUIREMENTS } from "./courses.ts";

/** Origins allowed to call this. A public wildcard is what made abuse cheap. */
const ALLOWED_ORIGINS = [
  "https://sav-krish.github.io",
  "http://localhost:4173",
  "http://localhost:5173",
];

const MAX_NAME_LENGTH = 60;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK, bytes.byteLength));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/** The name is learner-supplied and lands in both a PDF and an HTML email. */
function cleanName(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * pdf-lib's standard fonts are WinAnsi-encoded and throw on anything outside
 * that range, which would fail outright for a good share of our learners'
 * names. Strip to what the font can draw rather than erroring, and fall back to
 * the account name if nothing printable survives.
 */
function toPrintable(name: string): string {
  const stripped = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  let out = "";
  for (const char of stripped) {
    out += char.charCodeAt(0) <= 0xff ? char : "";
  }
  return out.replace(/\s+/g, " ").trim();
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Certificate service is not configured." }, 500, origin);
  }

  try {
    // ---- 1. Who is asking -------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!token) {
      return json({ error: "Sign in to claim your certificate." }, 401, origin);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user?.id) {
      return json({ error: "Sign in to claim your certificate." }, 401, origin);
    }

    const body = await req.json().catch(() => ({}));
    const courseId = String(body?.courseId ?? "").toLowerCase();
    const course = COURSE_REQUIREMENTS[courseId];
    if (!course) {
      return json({ error: "Unknown course." }, 400, origin);
    }

    // The email is the account's, not whatever was posted. Otherwise this is a
    // way to have Techinance send attachments to arbitrary addresses.
    const studentEmail = user.email ?? "";
    if (!studentEmail) {
      return json({ error: "Your account has no email address." }, 400, origin);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ---- 2. Did they actually finish it -----------------------------------
    const { data: progress, error: progressErr } = await admin
      .from("episode_progress")
      .select("episode_id, completed")
      .eq("user_id", user.id)
      .in("episode_id", course.episodes);

    if (progressErr) {
      return json({ error: "Could not read your progress." }, 500, origin);
    }

    const finished = new Set(
      (progress ?? []).filter((row) => row.completed).map((row) => row.episode_id),
    );
    const missing = course.episodes.filter((id) => !finished.has(id));
    if (missing.length > 0) {
      return json(
        { error: "Finish every unit in this course first.", remaining: missing.length },
        403,
        origin,
      );
    }

    // ---- 3. One certificate per learner per course ------------------------
    const { data: existing } = await admin
      .from("certificates")
      .select("id, pdf_url")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existing?.pdf_url) {
      return json({ ok: true, pdfUrl: existing.pdf_url, alreadyIssued: true }, 200, origin);
    }

    // ---- 4. Name on the certificate ---------------------------------------
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const fallback = cleanName(profile?.display_name) || "Learner";
    const studentName = cleanName(body?.studentName) || fallback;
    const printableName = toPrintable(studentName) || toPrintable(fallback) || "Learner";

    // ---- 5. Draw it -------------------------------------------------------
    const templateBase64 =
      COURSE_TEMPLATES_BASE64[courseId] ?? COURSE_TEMPLATES_BASE64["financial-literacy"];
    let templateBytes: Uint8Array;
    try {
      const res = await fetch(
        `${supabaseUrl}/storage/v1/object/public/certificates/${courseId}-template.pdf`,
      );
      templateBytes = res.ok
        ? new Uint8Array(await res.arrayBuffer())
        : base64ToUint8Array(templateBase64);
    } catch {
      templateBytes = base64ToUint8Array(templateBase64);
    }

    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    // Cover the {Name} placeholder baked into the template.
    page.drawRectangle({
      x: width * 0.33,
      y: height * 0.435,
      width: width * 0.34,
      height: height * 0.11,
      color: rgb(1, 1, 1),
    });

    const font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    // Shrink rather than run past the edge of the patch.
    let fontSize = 38;
    const maxWidth = width * 0.32;
    while (fontSize > 16 && font.widthOfTextAtSize(printableName, fontSize) > maxWidth) {
      fontSize -= 1;
    }
    const nameWidth = font.widthOfTextAtSize(printableName, fontSize);
    page.drawText(printableName, {
      x: (width - nameWidth) / 2,
      y: height * 0.47,
      size: fontSize,
      font,
      color: rgb(15 / 255, 32 / 255, 66 / 255),
    });

    const pdfBytes = await pdfDoc.save();

    // ---- 6. Store and record ----------------------------------------------
    const filePath = `${user.id}/${courseId}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from("certificates")
      .upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadErr) {
      return json({ error: "Could not store your certificate." }, 500, origin);
    }

    const { data: signed } = await admin.storage
      .from("certificates")
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);
    const pdfUrl = signed?.signedUrl ?? "";

    await admin.from("certificates").upsert(
      {
        user_id: user.id,
        student_name: studentName,
        student_email: studentEmail,
        course_id: courseId,
        course_name: course.name,
        pdf_path: filePath,
        pdf_url: pdfUrl,
        status: "issued",
      },
      { onConflict: "user_id,course_id" },
    );

    // ---- 7. Email it ------------------------------------------------------
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const senderEmail =
        Deno.env.get("RESEND_SENDER_EMAIL") || "Techinance <onboarding@resend.dev>";
      const safeName = escapeHtml(studentName);
      const safeCourse = escapeHtml(course.name);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: senderEmail,
          to: [studentEmail],
          subject: `Your Techinance ${course.name} certificate`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h1 style="color: #0b2447; font-size: 22px;">Congratulations, ${safeName}</h1>
              <p style="color: #5a6b80; font-size: 15px; line-height: 1.6;">
                You have completed the Techinance ${safeCourse} course. Your certificate is attached.
              </p>
              <p style="color: #94a3b8; font-size: 13px;">
                &copy; ${new Date().getFullYear()} Techinance, a registered 501(c)(3) nonprofit.
              </p>
            </div>
          `,
          attachments: [
            {
              filename: `Techinance_${course.name.replace(/\s+/g, "_")}_Certificate.pdf`,
              content: uint8ArrayToBase64(pdfBytes),
            },
          ],
        }),
      });
      await admin
        .from("certificates")
        .update({ status: res.ok ? "delivered" : "issued" })
        .eq("user_id", user.id)
        .eq("course_id", courseId);
    }

    return json({ ok: true, pdfUrl, course: course.name }, 200, origin);
  } catch {
    // Deliberately vague: the caller does not need our internals.
    return json({ error: "Could not generate the certificate." }, 500, origin);
  }
});
