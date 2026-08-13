import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { TEMPLATE_PDF_BASE64 } from "./template-base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, studentName, studentEmail, courseId, courseName } = await req.json();

    if (!studentName || !studentEmail) {
      return new Response(
        JSON.stringify({ error: "studentName and studentEmail are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const senderEmail = Deno.env.get("RESEND_SENDER_EMAIL") || "Techinance <onboarding@resend.dev>";

    const displayCourse = courseName || "Financial Literacy";
    const formattedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // 1. Fetch base PDF template (or fallback to embedded template)
    let templateBytes: Uint8Array;
    try {
      const templateUrl = `${supabaseUrl}/storage/v1/object/public/certificates/template.pdf`;
      const pdfRes = await fetch(templateUrl);
      if (pdfRes.ok) {
        templateBytes = new Uint8Array(await pdfRes.arrayBuffer());
      } else {
        templateBytes = base64ToUint8Array(TEMPLATE_PDF_BASE64);
      }
    } catch {
      templateBytes = base64ToUint8Array(TEMPLATE_PDF_BASE64);
    }

    // 2. Load PDF document with pdf-lib
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    // 3. Erase {Name} placeholder text on PDF with white patch
    page.drawRectangle({
      x: width * 0.33,
      y: height * 0.435,
      width: width * 0.34,
      height: height * 0.11,
      color: rgb(1, 1, 1),
    });

    // 4. Embed font & write Student Name
    const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const fontSize = 38;
    const nameWidth = fontHelveticaBold.widthOfTextAtSize(studentName, fontSize);
    const nameX = (width - nameWidth) / 2;
    const nameY = height * 0.47;

    page.drawText(studentName, {
      x: nameX,
      y: nameY,
      size: fontSize,
      font: fontHelveticaBold,
      color: rgb(15 / 255, 32 / 255, 66 / 255),
    });

    // Generate PDF Bytes & Base64
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = uint8ArrayToBase64(pdfBytes);

    let publicPdfUrl = "";
    let resendId = null;

    // 5. Upload to Supabase Storage if service role key is present
    if (supabaseUrl && supabaseServiceKey && userId) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const filePath = `${userId}/${courseId || "course"}-${Date.now()}.pdf`;

      const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
        .from("certificates")
        .upload(filePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        const { data: urlData } = supabaseAdmin.storage
          .from("certificates")
          .getPublicUrl(filePath);
        publicPdfUrl = urlData.publicUrl;

        // Save DB record
        await supabaseAdmin.from("certificates").insert({
          user_id: userId,
          student_name: studentName,
          student_email: studentEmail,
          course_id: courseId || "course",
          course_name: displayCourse,
          pdf_path: filePath,
          pdf_url: publicPdfUrl,
          status: resendApiKey ? "generating" : "generated",
        });
      }
    }

    // 6. Send Email via Resend API if API Key is configured
    if (resendApiKey) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: senderEmail,
          to: [studentEmail],
          subject: `🎓 Your Certificate of Completion for Techinance ${displayCourse}!`,
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #0f172a; margin-bottom: 8px;">Congratulations, ${studentName}! 🎓</h1>
                <p style="color: #475569; font-size: 16px; margin: 0;">You have successfully completed the <strong>Techinance ${displayCourse} Course</strong>.</p>
              </div>
              <div style="background: #ffffff; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; text-align: center;">
                <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                  We are thrilled to award you your official Certificate of Completion! Your dedication to expanding your financial literacy and technical skills is truly commendable.
                </p>
                <div style="margin-top: 20px;">
                  <a href="${publicPdfUrl || '#'}" target="_blank" style="display: inline-block; background: #1e3a8a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">Download Certificate PDF</a>
                </div>
              </div>
              <div style="text-align: center; color: #94a3b8; font-size: 13px;">
                <p>&copy; ${new Date().getFullYear()} Techinance. All rights reserved.</p>
              </div>
            </div>
          `,
          attachments: [
            {
              filename: `Techinance_${displayCourse.replace(/\s+/g, "_")}_Certificate.pdf`,
              content: pdfBase64,
            },
          ],
        }),
      });

      const resendData = await resendRes.json();
      console.log("Resend API response:", resendData);
      if (resendRes.ok) {
        resendId = resendData.id;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        pdfUrl: publicPdfUrl,
        resendId: resendId,
        message: resendApiKey
          ? "Certificate generated and emailed successfully via Resend!"
          : "Certificate generated successfully (Email pending RESEND_API_KEY setup).",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error generating certificate" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
