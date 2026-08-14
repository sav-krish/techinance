// @ts-check

/**
 * Automated Certificate Generation and Emailing Module.
 * 
 * Provides:
 * 1. Automatic course completion detection.
 * 2. Instant client-side PDF certificate rendering using pdf-lib (for instant PDF download & preview).
 * 3. Supabase Edge Function invocation to save PDF to Supabase Storage & auto-email via Resend.
 * 4. Certificate Modal UI with native PDF preview and download.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getUser } from "./auth.js";
import { getProgress } from "./progress.js";
import { isRemoteEnabled, supabase } from "./supabase.js";
import { SUPABASE_URL } from "./supabase-config.js";

/** Map of course IDs to metadata */
export const COURSE_DEFINITIONS = {
  "financial-literacy": {
    id: "financial-literacy",
    title: "Financial Literacy",
    description: "gaining essential knowledge in money management, budgeting, and financial planning.",
    episodes: ["fin-u1", "fin-u2", "fin-u3", "fin-u4"],
    templatePdf: "certificate-template.pdf",
  },
  "cybersecurity": {
    id: "cybersecurity",
    title: "Cybersecurity Essentials",
    description: "mastering digital safety, threat awareness, and secure online practices.",
    episodes: ["cyber-u1", "cyber-u2", "cyber-u3", "cyber-u4"],
    templatePdf: "cybersecurity-certificate-template.pdf",
  },
  "neuroscience": {
    id: "neuroscience",
    title: "Neuroscience & Mindset",
    description: "understanding decision making, brain science, and behavioral economics.",
    episodes: ["neuro-u1", "neuro-u2", "neuro-u3", "neuro-u4"],
    templatePdf: "neuroscience-certificate-template.pdf",
  },
  "startup": {
    id: "startup",
    title: "Startup & Entrepreneurship",
    description: "learning business strategy, venture building, and financial modeling.",
    episodes: ["startup-u1", "startup-u2", "startup-u3", "startup-u4", "startup-u5", "startup-u6"],
    templatePdf: "startup-certificate-template.pdf",
  },
};

const TEMPLATE_PDF_SRC = "certificate-template.pdf";

/**
 * Checks if a user has completed ALL episodes in a course.
 * @param {string} userId
 * @param {string} [epId]
 * @returns {{ isCourseCompleted: boolean, courseId: string, courseTitle: string, templatePdf: string } | null}
 */
export function checkCourseCompletion(userId, epId) {
  const progress = getProgress(userId);
  if (!progress || !progress.episodes) {
    return null;
  }

  for (const [courseId, def] of Object.entries(COURSE_DEFINITIONS)) {
    if (epId && !def.episodes.includes(epId)) {
      continue;
    }
    // Strict requirement: ALL episodes in def.episodes MUST be completed!
    const allCompleted = def.episodes.length > 0 && def.episodes.every(id => progress.episodes[id]?.completed);
    if (allCompleted) {
      return {
        isCourseCompleted: true,
        courseId: def.id,
        courseTitle: def.title,
        templatePdf: def.templatePdf,
      };
    }
  }

  return null;
}

/**
 * Generates the certificate PDF from the public PDF template using pdf-lib.
 * @param {string} name - Student's full name
 * @param {string} [courseTitle] - Name of the completed course
 * @param {string} [templatePdfSrc] - Specific course PDF template path
 * @returns {Promise<Uint8Array>} PDF byte array
 */
export async function generateCertificatePdfBytes(name, courseTitle = "Financial Literacy", templatePdfSrc = TEMPLATE_PDF_SRC) {
  let response = await fetch(templatePdfSrc);
  if (!response.ok && templatePdfSrc !== TEMPLATE_PDF_SRC) {
    // Fall back to default template if course-specific template is not yet added
    response = await fetch(TEMPLATE_PDF_SRC);
  }
  if (!response.ok) {
    throw new Error("Failed to fetch certificate template PDF");
  }
  const existingPdfBytes = await response.arrayBuffer();

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  // 1. Erase {Name} placeholder text on PDF with white patch
  page.drawRectangle({
    x: width * 0.33,
    y: height * 0.435,
    width: width * 0.34,
    height: height * 0.11,
    color: rgb(1, 1, 1),
  });

  // 2. Render student's name in dark navy TimesRomanItalic font
  const font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const studentName = name && name.trim() ? name.trim() : "Learner";
  const fontSize = studentName.length > 25 ? 26 : studentName.length > 18 ? 32 : 38;
  const nameWidth = font.widthOfTextAtSize(studentName, fontSize);

  page.drawText(studentName, {
    x: (width - nameWidth) / 2,
    y: height * 0.47,
    size: fontSize,
    font,
    color: rgb(15 / 255, 32 / 255, 66 / 255),
  });

  return await pdfDoc.save();
}

/**
 * Downloads the generated PDF certificate directly in browser.
 * @param {Uint8Array} pdfBytes
 * @param {string} studentName
 * @param {string} courseId
 */
export function downloadCertificatePdf(pdfBytes, studentName = "Learner", courseId = "financial-literacy") {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = studentName.replace(/[^a-zA-Z0-9]/g, "_");
  link.download = `Techinance_${courseId}_Certificate_${safeName}.pdf`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Triggers the backend Supabase Edge Function to generate PDF & email via Resend API.
 * @param {{ userId?: string, studentName: string, studentEmail: string, courseId: string, courseName: string }} options
 * @returns {Promise<{ ok: boolean, pdfUrl?: string, resendId?: string, message?: string }>}
 */
export async function triggerRemoteCertificateService(options) {
  const user = getUser();
  const studentName = options.studentName || user?.name || "Learner";
  const studentEmail = options.studentEmail || user?.email || "";
  const userId = options.userId || user?.id || "";

  if (isRemoteEnabled() && SUPABASE_URL) {
    try {
      const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/generate-certificate`;
      const client = supabase();
      const session = client ? (await client.auth.getSession()).data?.session : null;
      const headers = {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      };

      const res = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          studentName,
          studentEmail,
          courseId: options.courseId || "financial-literacy",
          courseName: options.courseName || "Financial Literacy",
        }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Edge Function call unavailable, utilizing browser PDF fallback", err);
    }
  }

  return { ok: false, message: "Client-only execution" };
}

/**
 * Shows the Certificate Modal UI upon course completion.
 * @param {{ studentName: string, studentEmail: string, courseId: string, courseTitle: string }} info
 */
export async function showCertificateModal(info) {
  if (document.getElementById("certificate-modal-overlay")) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "certificate-modal-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(8px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  `;

  const container = document.createElement("div");
  container.style.cssText = `
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 16px;
    width: 100%;
    max-width: 760px;
    padding: 28px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    color: #f8fafc;
    text-align: center;
    box-sizing: border-box;
  `;

  container.innerHTML = `
    <div style="font-size: 42px; margin-bottom: 8px;">🎓</div>
    <h2 style="font-size: 26px; font-weight: 700; margin: 0 0 8px 0; color: #f8fafc;">Course Complete!</h2>
    <p style="color: #94a3b8; font-size: 15px; margin: 0 0 20px 0;">
      Congratulations <strong>${escapeHtml(info.studentName)}</strong>! Here is your official Certificate of Completion for <strong>${escapeHtml(info.courseTitle)}</strong>.
    </p>

    <div id="cert-pdf-container" style="margin: 0 auto 20px auto; max-width: 100%; height: 380px; border-radius: 8px; border: 1px solid #334155; overflow: hidden; background: #020617; display: flex; align-items: center; justify-content: center;">
      <div style="color: #94a3b8; font-size: 14px;">Generating your PDF certificate...</div>
    </div>

    <div id="cert-email-status" style="margin-bottom: 20px; font-size: 14px; color: #38bdf8; min-height: 20px;">
      🚀 Auto-emailing certificate via Resend...
    </div>

    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
      <button id="download-cert-btn" type="button" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
        📥 Download Certificate (PDF)
      </button>
      <button id="close-cert-btn" type="button" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; cursor: pointer;">
        Close
      </button>
    </div>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  let pdfBytesRef;
  try {
    const templatePdf = COURSE_DEFINITIONS[info.courseId]?.templatePdf || TEMPLATE_PDF_SRC;
    pdfBytesRef = await generateCertificatePdfBytes(info.studentName, info.courseTitle, templatePdf);
    const blob = new Blob([pdfBytesRef], { type: "application/pdf" });
    const pdfUrl = URL.createObjectURL(blob);

    const pdfContainer = document.getElementById("cert-pdf-container");
    if (pdfContainer) {
      pdfContainer.innerHTML = `<iframe src="${pdfUrl}#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>`;
    }
  } catch (err) {
    console.error("PDF generation error", err);
  }

  // Trigger remote service & Resend email
  triggerRemoteCertificateService({
    studentName: info.studentName,
    studentEmail: info.studentEmail,
    courseId: info.courseId,
    courseName: info.courseTitle,
  }).then((res) => {
    const statusEl = document.getElementById("cert-email-status");
    if (statusEl) {
      if (res.ok && res.resendId) {
        statusEl.style.color = "#4ade80";
        statusEl.innerHTML = "✅ Certificate emailed to <strong>" + escapeHtml(info.studentEmail) + "</strong>!";
      } else if (res.ok && res.pdfUrl) {
        statusEl.style.color = "#38bdf8";
        statusEl.innerHTML = "✅ Certificate stored safely in your account profile!";
      } else {
        statusEl.style.color = "#94a3b8";
        statusEl.innerHTML = "💡 Instant PDF certificate download ready below!";
      }
    }
  });

  document.getElementById("download-cert-btn")?.addEventListener("click", () => {
    if (pdfBytesRef) {
      downloadCertificatePdf(pdfBytesRef, info.studentName, info.courseId);
    }
  });

  document.getElementById("close-cert-btn")?.addEventListener("click", () => {
    overlay.remove();
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function handleAutoCertificateOnCompletion(userId, epId) {
  const user = getUser();
  const studentName = user?.name || "Learner";
  const studentEmail = user?.email || "";

  const courseInfo = checkCourseCompletion(userId, epId);
  if (courseInfo && courseInfo.isCourseCompleted) {
    showCertificateModal({
      studentName,
      studentEmail,
      courseId: courseInfo.courseId,
      courseTitle: courseInfo.courseTitle,
    });
  }
}
