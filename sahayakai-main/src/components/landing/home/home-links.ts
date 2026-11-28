/**
 * Outbound links and media used by the homepage and /features.
 * Same destinations as /for-schools, so every page sends a school to the
 * same demo booking and plays the same film.
 */
export const CALENDLY_URL = "https://calendly.com/contact-sargvision/30min";

/** The SahayakAI film on the SARGVISION YouTube channel. */
export const FILM_ID = "Y24Sox3NRGE";
export const FILM_LENGTH = "2:43";

/** The SahayakAI Teachers Community on WhatsApp (the QR on the page encodes this link). */
export const COMMUNITY_URL = "https://chat.whatsapp.com/CQFH0CBeetzAaXg4BIouno";

export const CONTACT_EMAIL = "contact@sargvision.com";
export const CONTACT_PHONE = "+91 6363740720";

/** Book a demo: WhatsApp with the founder when the number is configured, else Calendly. */
export function demoHref(): string {
  const phone = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP?.replace(/\D/g, "");
  if (!phone) return CALENDLY_URL;
  const message = encodeURIComponent(
    "Hi, I saw the SahayakAI website. I would like a 30-minute demo for our school.",
  );
  return `https://wa.me/${phone}?text=${message}`;
}
