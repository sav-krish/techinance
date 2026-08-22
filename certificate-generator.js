// @ts-check

/**
 * Certificate claiming.
 *
 * Everything here is about the *offer*: noticing that a learner looks finished,
 * showing the claim button, and rendering a local preview. None of it decides
 * whether a certificate is real. That call belongs to the `generate-certificate`
 * edge function, which re-checks the learner's token and their episode progress
 * server-side and refuses if any unit is outstanding.
 *
 * Keep it that way. `checkCourseCompletion` reads localStorage, which the
 * learner controls, so treating it as proof would put the answer back in the
 * browser's hands. The episode list below is mirrored in
 * supabase/functions/generate-certificate/courses.ts; if the two disagree the
 * server's copy wins.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getUser } from "./auth.js";
import { getProgress } from "./progress.js";
import { flushProgressNow } from "./progress-sync.js";
import { isRemoteEnabled, supabase } from "./supabase.js";
import { SUPABASE_URL } from "./supabase-config.js";

/** Map of course IDs to metadata */
/** @type {Record<string, { id: string, title: string, description: string, episodes: string[], templatePdf: string }>} */
export const COURSE_DEFINITIONS = {
  "financial-literacy": {
    id: "financial-literacy",
    title: "Financial Literacy",
    description: "gaining essential knowledge in money management, budgeting, and financial planning.",
    episodes: ["fin-u1", "fin-u2", "fin-u3", "fin-u4"],
    templatePdf: "finance-certificate-template.pdf",
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

const TEMPLATE_PDF_SRC = "finance-certificate-template.pdf";

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

  for (const def of Object.values(COURSE_DEFINITIONS)) {
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
 * @param {string} [templatePdfSrc] - Specific course PDF template path
 * @returns {Promise<Uint8Array>} PDF byte array
 */
export async function generateCertificatePdfBytes(name, templatePdfSrc = TEMPLATE_PDF_SRC) {
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
  // Measure and shrink rather than guessing from character count. Stepping on
  // length alone let "Priya Raghunathan" run 29pt past the patch that covers
  // the template's {Name} placeholder, and a long name 139pt past it. The edge
  // function does the same, so the download matches the emailed copy.
  let fontSize = 38;
  const maxWidth = width * 0.32;
  while (fontSize > 16 && font.widthOfTextAtSize(studentName, fontSize) > maxWidth) {
    fontSize -= 1;
  }
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
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
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
 * Asks the server to issue the certificate.
 *
 * Only `studentName` and `courseId` are sent. The user id and email come from
 * the access token on the server side, so passing them would achieve nothing
 * except suggesting they were trusted.
 *
 * A refusal is a real answer, not a transport failure: the server returns 403
 * when units are outstanding, and the caller must not fall back to drawing a
 * certificate locally in that case.
 *
 * @param {{ studentName: string, courseId: string }} options
 * @returns {Promise<{ ok: boolean, pdfUrl?: string, alreadyIssued?: boolean,
 *   refused?: boolean, unavailable?: boolean, error?: string }>}
 */
export async function triggerRemoteCertificateService(options) {
  if (!isRemoteEnabled() || !SUPABASE_URL) {
    return { ok: false, unavailable: true };
  }

  const client = supabase();
  const session = client ? (await client.auth.getSession()).data?.session : null;
  if (!session?.access_token) {
    return { ok: false, refused: true, error: "Sign in to claim your certificate." };
  }

  // The server decides from episode_progress, and background syncing is
  // debounced, so the episode just finished may not have landed yet. Push
  // before asking or a genuine finisher gets told they have not finished.
  await flushProgressNow();

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-certificate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        studentName: options.studentName,
        courseId: options.courseId,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, pdfUrl: payload.pdfUrl, alreadyIssued: payload.alreadyIssued };
    }
    // 401/403 mean "no", and the answer stands. Anything else is a fault on our
    // side, which still must not hand out a certificate.
    return {
      ok: false,
      refused: res.status === 401 || res.status === 403,
      error: typeof payload.error === "string" ? payload.error : "Could not issue your certificate.",
    };
  } catch {
    return { ok: false, unavailable: true };
  }
}

/**
 * Shows the certificate modal.
 *
 * No email argument: the server takes the address from the signed-in account,
 * so passing one here would only imply it was honoured.
 *
 * @param {{ studentName: string, courseId: string, courseTitle: string }} info
 * @returns {Promise<void>}
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
      <div style="color: #94a3b8; font-size: 14px;">Checking your progress...</div>
    </div>

    <div id="cert-email-status" style="margin-bottom: 20px; font-size: 14px; color: #38bdf8; min-height: 20px;">
      Checking your progress...
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

  const statusEl = document.getElementById("cert-email-status");
  const downloadBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById("download-cert-btn")
  );
  const pdfContainer = document.getElementById("cert-pdf-container");

  /**
   * @param {string} message
   * @param {string} color
   * @returns {void}
   */
  function setStatus(message, color) {
    if (statusEl) {
      statusEl.style.color = color;
      statusEl.textContent = message;
    }
  }

  // Nothing downloadable exists until the server says this was earned. Drawing
  // the PDF first and asking afterwards, as this once did, meant a learner who
  // had finished nothing still walked away with a certificate file.
  if (downloadBtn) {
    downloadBtn.disabled = true;
  }
  setStatus("Checking your progress...", "#94a3b8");

  const issued = await triggerRemoteCertificateService({
    studentName: info.studentName,
    courseId: info.courseId,
  });

  if (issued.refused) {
    setStatus(issued.error || "Finish every unit in this course first.", "#fca5a5");
    if (pdfContainer) {
      pdfContainer.textContent = "";
    }
    document.getElementById("close-cert-btn")?.addEventListener("click", () => overlay.remove());
    return;
  }

  /** @type {Uint8Array | undefined} */
  let pdfBytesRef;
  if (issued.ok) {
    setStatus(
      issued.alreadyIssued
        ? "You already have this certificate. A copy is below."
        : "Certificate issued and emailed to you.",
      "#4ade80",
    );
  } else {
    // The service is unreachable or erroring. Say so plainly rather than
    // implying the certificate was recorded.
    setStatus("We could not reach the certificate service. Try again later.", "#94a3b8");
    document.getElementById("close-cert-btn")?.addEventListener("click", () => overlay.remove());
    return;
  }

  try {
    const templatePdf = COURSE_DEFINITIONS[info.courseId]?.templatePdf || TEMPLATE_PDF_SRC;
    pdfBytesRef = await generateCertificatePdfBytes(info.studentName, templatePdf);
    const blob = new Blob([new Uint8Array(pdfBytesRef)], { type: "application/pdf" });
    if (pdfContainer) {
      pdfContainer.innerHTML =
        `<iframe src="${URL.createObjectURL(blob)}#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>`;
    }
    if (downloadBtn) {
      downloadBtn.disabled = false;
    }
  } catch {
    // The local preview is a nicety; the issued file is the real artefact.
    if (issued.pdfUrl && pdfContainer) {
      pdfContainer.innerHTML =
        `<iframe src="${issued.pdfUrl}#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>`;
    }
  }

  downloadBtn?.addEventListener("click", () => {
    if (pdfBytesRef) {
      downloadCertificatePdf(pdfBytesRef, info.studentName, info.courseId);
    } else if (issued.pdfUrl) {
      window.open(issued.pdfUrl, "_blank", "noopener");
    }
  });

  document.getElementById("close-cert-btn")?.addEventListener("click", () => {
    overlay.remove();
  });
}

/**
 * @param {unknown} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} userId
 * @param {string} epId
 * @returns {void}
 */
export function handleAutoCertificateOnCompletion(userId, epId) {
  const courseInfo = checkCourseCompletion(userId, epId);
  if (courseInfo && courseInfo.isCourseCompleted) {
    showCertificateModal({
      studentName: getUser()?.name || "Learner",
      courseId: courseInfo.courseId,
      courseTitle: courseInfo.courseTitle,
    });
  }
}
