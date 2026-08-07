// @ts-check

/**
 * Work with Us form.
 *
 * Submits through FormSubmit, the same relay contact.js uses, so both forms
 * reach the same inbox. If that request fails the person still gets a prefilled
 * mailto: link, so a submission is never silently lost.
 *
 * The success copy is written from the outcome, not assumed: it only says the
 * message was sent when the request actually succeeded.
 */

// Marks the file as a module. It's loaded with <script type="module">, but with
// no import or export of its own TypeScript treats it as a global script and its
// top-level consts collide with contact.js.
export {};

const CONTACT_EMAIL = "thetechinance@gmail.com";
const FORM_SUBMIT_URL = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * @param {string} selector
 * @returns {HTMLElement}
 */
function getHtmlElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

/**
 * @param {string} selector
 * @returns {HTMLFormElement}
 */
function getFormElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLFormElement)) {
    throw new Error(`Missing required form: ${selector}`);
  }
  return element;
}

/**
 * @param {string} selector
 * @returns {HTMLInputElement}
 */
function getInputElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Missing required input: ${selector}`);
  }
  return element;
}

/**
 * @param {string} selector
 * @returns {HTMLSelectElement}
 */
function getSelectElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`Missing required select: ${selector}`);
  }
  return element;
}

/**
 * @param {string} selector
 * @returns {HTMLTextAreaElement}
 */
function getTextAreaElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error(`Missing required textarea: ${selector}`);
  }
  return element;
}

/**
 * @param {string} selector
 * @returns {HTMLButtonElement}
 */
function getButtonElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing required button: ${selector}`);
  }
  return element;
}

/**
 * @param {string} selector
 * @returns {HTMLAnchorElement}
 */
function getAnchorElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLAnchorElement)) {
    throw new Error(`Missing required link: ${selector}`);
  }
  return element;
}

const form = getFormElement("[data-involve-form]");
const statusEl = getHtmlElement("[data-involve-status]");
const successEl = getHtmlElement("[data-involve-success]");
const successTitleEl = getHtmlElement("[data-involve-success-title]");
const successBodyEl = getHtmlElement("[data-involve-success-body]");
const mailtoWrap = getHtmlElement("[data-involve-mailto-wrap]");
const mailtoLink = getAnchorElement("[data-involve-mailto]");
const editButton = getButtonElement("[data-involve-edit]");
const submitButton = getButtonElement("[data-involve-submit]");

const firstNameInput = getInputElement("#involve-first-name");
const lastNameInput = getInputElement("#involve-last-name");
const emailInput = getInputElement("#involve-email");
const roleSelect = getSelectElement("#involve-role");
const messageInput = getTextAreaElement("#involve-message");

/**
 * @typedef {HTMLInputElement | HTMLSelectElement} ValidatedControl
 */

/**
 * @typedef {object} FieldCheck
 * @property {ValidatedControl} control
 * @property {HTMLElement} errorEl
 * @property {() => string} validate Returns an error message, or "" when valid.
 */

/** @type {FieldCheck[]} */
const checks = [
  {
    control: firstNameInput,
    errorEl: getHtmlElement("#involve-first-name-error"),
    validate: () => (firstNameInput.value.trim() === "" ? "Enter your first name." : ""),
  },
  {
    control: lastNameInput,
    errorEl: getHtmlElement("#involve-last-name-error"),
    validate: () => (lastNameInput.value.trim() === "" ? "Enter your last name." : ""),
  },
  {
    control: emailInput,
    errorEl: getHtmlElement("#involve-email-error"),
    validate: () => {
      const value = emailInput.value.trim();
      if (value === "") {
        return "Enter your email address.";
      }
      if (!EMAIL_PATTERN.test(value)) {
        return "Enter an email address that looks like name@example.com.";
      }
      return "";
    },
  },
  {
    control: roleSelect,
    errorEl: getHtmlElement("#involve-role-error"),
    validate: () => (roleSelect.value === "" ? "Choose how you'd like to work with us." : ""),
  },
];

/**
 * @param {string} message
 * @param {boolean} isError
 * @returns {void}
 */
function setStatus(message, isError) {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", isError);
}

/**
 * @returns {void}
 */
function clearStatus() {
  statusEl.hidden = true;
  statusEl.textContent = "";
  statusEl.classList.remove("is-error");
}

/**
 * @param {FieldCheck} field
 * @param {string} message
 * @returns {void}
 */
function setFieldError(field, message) {
  const hasError = message !== "";
  field.errorEl.hidden = !hasError;
  field.errorEl.textContent = message;
  field.control.classList.toggle("is-invalid", hasError);
  field.control.setAttribute("aria-invalid", hasError ? "true" : "false");
}

for (const field of checks) {
  field.control.addEventListener("input", () => {
    if (field.errorEl.hidden) {
      return;
    }
    setFieldError(field, field.validate());
  });
  field.control.addEventListener("change", () => {
    if (field.errorEl.hidden) {
      return;
    }
    setFieldError(field, field.validate());
  });
}

/**
 * @returns {FieldCheck[]} The fields that failed, in document order.
 */
function runChecks() {
  /** @type {FieldCheck[]} */
  const failed = [];
  for (const field of checks) {
    const message = field.validate();
    setFieldError(field, message);
    if (message !== "") {
      failed.push(field);
    }
  }
  return failed;
}

/**
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} email
 * @param {string} role
 * @param {string} message
 * @returns {string}
 */
function buildMailto(firstName, lastName, email, role, message) {
  const subject = `Work with Us: ${role}`;
  const lines = [
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `How I want to work with Techinance: ${role}`,
    "",
    message === "" ? "(No extra details.)" : message,
  ];
  const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    lines.join("\n"),
  )}`;
  return `mailto:${CONTACT_EMAIL}?${query}`;
}

/**
 * @param {boolean} sending
 * @returns {void}
 */
function setSubmitting(sending) {
  submitButton.disabled = sending;
  submitButton.textContent = sending ? "Sending…" : "Submit";
}

/**
 * @returns {void}
 */
function showForm() {
  successEl.hidden = true;
  form.hidden = false;
  clearStatus();
  firstNameInput.focus();
}

editButton.addEventListener("click", () => {
  showForm();
});

/**
 * Swaps the success panel between "we received it" and "send it yourself",
 * depending on whether the request actually got through.
 *
 * @param {string} firstName
 * @param {boolean} sent
 * @returns {void}
 */
function showSuccess(firstName, sent) {
  successTitleEl.textContent = sent
    ? `Thanks ${firstName}, we have your answers`
    : `Thanks ${firstName}, your answers are ready to send`;
  successBodyEl.textContent = sent
    ? "Your message is on its way to the Techinance team. We'll be in touch, usually within a week. There's nothing else you need to do."
    : "We couldn't reach our mail service just now, so nothing has been sent yet. The button below opens your email app with your answers already filled in.";
  mailtoWrap.hidden = sent;

  clearStatus();
  form.hidden = true;
  successEl.hidden = false;
  successEl.focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const failed = runChecks();
  if (failed.length > 0) {
    setStatus(
      failed.length === 1
        ? "One field needs fixing before you can continue."
        : `${failed.length} fields need fixing before you can continue.`,
      true,
    );
    failed[0].control.focus();
    return;
  }

  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const email = emailInput.value.trim();
  const role = roleSelect.value;
  const message = messageInput.value.trim();

  // The mailto is built either way, so the fallback is ready if the post fails.
  mailtoLink.href = buildMailto(firstName, lastName, email, role, message);

  setSubmitting(true);
  setStatus("Sending your answers…", false);

  try {
    const response = await fetch(FORM_SUBMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        email,
        role,
        message,
        _subject: `Techinance Work with Us from ${firstName} ${lastName}`,
        _replyto: email,
        _captcha: "false",
      }),
    });

    showSuccess(firstName, response.ok);
  } catch {
    showSuccess(firstName, false);
  } finally {
    setSubmitting(false);
  }
});
