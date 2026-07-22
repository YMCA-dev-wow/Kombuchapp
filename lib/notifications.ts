import "server-only";
import { Resend } from "resend";

// =======================================================================
// Couche de NOTIFICATIONS, pensee pour rester modulaire.
//
// Aujourd'hui : un seul "canal" est branche -> l'email via Resend.
// Plus tard : il suffira d'ajouter un nouveau canal (ex: WebPushChannel)
// dans le tableau `channels` ci-dessous pour envoyer aussi des
// notifications Web Push (PWA), SANS toucher au reste du code (routes
// API, pages...) qui appelle uniquement `notify(event)`.
//
// IMPORTANT : chaque destinataire (producteur / client) recoit un email
// envoye dans un appel SEPARE a Resend. Si on les groupe dans un seul
// envoi (un seul "to" avec plusieurs adresses), un probleme sur UNE
// adresse (ex: domaine d'envoi non verifie, adresse invalide) fait
// echouer l'envoi en entier -- y compris pour l'autre destinataire.
// En les separant, chaque email reussit ou echoue independamment.
// =======================================================================

export type NotificationEvent =
  | {
      type: "nouvelle_commande_stock";
      recipeName: string;
      quantity: number;
      customerName: string;
      customerEmail?: string | null;
    }
  | {
      type: "nouvelle_demande_sur_commande";
      recipeName: string;
      quantity: number;
      desiredDate?: string | null;
      customerName: string;
      customerEmail?: string | null;
    }
  | {
      type: "commande_personnalisee_validee" | "commande_personnalisee_refusee";
      recipeName: string;
      customerEmail?: string | null;
      adminNote?: string;
    };

export interface NotificationChannel {
  name: string;
  send(event: NotificationEvent): Promise<void>;
}

// -----------------------------------------------------------------------
// Canal EMAIL (Resend) - actif par defaut.
// Necessite RESEND_API_KEY + RESEND_FROM_EMAIL + ADMIN_NOTIFICATION_EMAIL
// dans .env.local. Si absents, le canal se contente d'un log (pas de crash).
//
// ATTENTION : avec l'adresse d'essai onboarding@resend.dev (domaine non
// verifie dans Resend), l'envoi vers de vrais destinataires n'est PAS
// fiable. Verifie ton propre nom de domaine dans Resend (Domains > Add
// domain) et utilise une adresse comme contact@tondomaine.fr dans
// RESEND_FROM_EMAIL des que possible -- voir GUIDE_DEMARRAGE.md.
// -----------------------------------------------------------------------
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;

type Message = { to: string; subject: string; html: string };

function buildMessages(event: NotificationEvent): Message[] {
  const messages: Message[] = [];

  switch (event.type) {
    case "nouvelle_commande_stock": {
      if (adminEmail) {
        messages.push({
          to: adminEmail,
          subject: `Nouvelle commande : ${event.recipeName} x${event.quantity}`,
          html: `<p>Commande confirmee pour <strong>${event.customerName}</strong></p>
                 <p>${event.quantity} x ${event.recipeName}</p>`,
        });
      }
      if (event.customerEmail) {
        messages.push({
          to: event.customerEmail,
          subject: `Commande confirmee : ${event.recipeName} x${event.quantity}`,
          html: `<p>Merci ${event.customerName} ! Ta commande de ${event.quantity} x ${event.recipeName} est confirmee.</p>
                 <p>Pense a venir la recuperer sous 7 jours.</p>`,
        });
      }
      break;
    }
    case "nouvelle_demande_sur_commande": {
      if (adminEmail) {
        messages.push({
          to: adminEmail,
          subject: `Nouvelle demande "sur commande" de ${event.customerName}`,
          html: `<p><strong>${event.customerName}</strong> demande ${event.quantity} x ${event.recipeName}</p>
                 ${event.desiredDate ? `<p>Date souhaitee : ${event.desiredDate}</p>` : ""}`,
        });
      }
      if (event.customerEmail) {
        messages.push({
          to: event.customerEmail,
          subject: `Ta demande "${event.recipeName}" a bien ete recue`,
          html: `<p>Merci ${event.customerName} ! Ta demande de ${event.quantity} x ${event.recipeName} a bien ete recue.</p>
                 <p>Elle est en attente de validation manuelle, tu recevras un email des que c'est fait.</p>`,
        });
      }
      break;
    }
    case "commande_personnalisee_validee":
    case "commande_personnalisee_refusee": {
      if (event.customerEmail) {
        const validee = event.type === "commande_personnalisee_validee";
        messages.push({
          to: event.customerEmail,
          subject: validee
            ? `Ta commande "${event.recipeName}" est validee !`
            : `A propos de ta demande "${event.recipeName}"`,
          html: `<p>${validee ? "Bonne nouvelle, ta demande a ete validee." : "Ta demande n'a malheureusement pas pu etre validee."}</p>
                 ${event.adminNote ? `<p>${event.adminNote}</p>` : ""}`,
        });
      }
      break;
    }
  }

  return messages;
}

const emailChannel: NotificationChannel = {
  name: "email",
  async send(event) {
    if (!resend) {
      console.log("[notifications:email] RESEND_API_KEY absent, notification ignoree:", event);
      return;
    }
    const messages = buildMessages(event);
    if (messages.length === 0) return;

    await Promise.all(
      messages.map(async (message) => {
        try {
          const { error } = await resend.emails.send({
            from: fromEmail,
            to: [message.to],
            subject: message.subject,
            html: message.html,
          });
          if (error) {
            // On ne bloque jamais une commande a cause d'un email qui echoue,
            // mais on log l'erreur precise renvoyee par Resend (visible dans
            // les logs Vercel) pour pouvoir diagnostiquer (ex: domaine non
            // verifie, adresse invalide...).
            console.error(`[notifications:email] echec d'envoi a ${message.to}:`, error);
          }
        } catch (err) {
          console.error(`[notifications:email] echec d'envoi a ${message.to}:`, err);
        }
      })
    );
  },
};

// -----------------------------------------------------------------------
// Canal WEB PUSH (PWA) - PLACEHOLDER pour une prochaine iteration.
// Pour l'activer : implementer send() (ex: avec la lib `web-push`),
// stocker les abonnements push des utilisateurs en base, puis ajouter
// `pushChannel` au tableau `channels` plus bas. Aucune autre partie du
// code n'a besoin de changer.
// -----------------------------------------------------------------------
// const pushChannel: NotificationChannel = {
//   name: "web-push",
//   async send(event) {
//     // TODO: envoyer une notification push aux abonnes concernes
//   },
// };

const channels: NotificationChannel[] = [emailChannel /*, pushChannel */];

export async function notify(event: NotificationEvent): Promise<void> {
  await Promise.all(channels.map((c) => c.send(event)));
}

// -----------------------------------------------------------------------
// DIFFUSION "nouveau stock disponible" : envoyee manuellement par le
// producteur a toute la liste d'abonnes (voir /api/subscribe et la table
// `subscribers`). Simple invitation a aller voir le site, sans detailler
// le stock dans le contenu du message.
//
// On utilise l'API "batch" de Resend (jusqu'a 100 emails par appel), ce
// qui correspond justement a la limite du plan gratuit (100 emails/jour) :
// une diffusion complete tient dans un seul quota journalier tant que la
// liste d'abonnes ne depasse pas 100 personnes.
// -----------------------------------------------------------------------
const BATCH_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function sendStockAvailableBroadcast(
  emails: string[],
  siteUrl: string
): Promise<{ sent: number }> {
  if (!resend) {
    console.log("[notifications:email] RESEND_API_KEY absent, diffusion ignoree.");
    return { sent: 0 };
  }
  if (emails.length === 0) {
    return { sent: 0 };
  }

  const html = `<p>Du nouveau kombucha vient d'arriver en stock !</p>
                <p><a href="${siteUrl}">Va jeter un oeil a la boutique</a> avant qu'il n'y en ait plus.</p>`;

  let sent = 0;
  for (const batch of chunk(emails, BATCH_SIZE)) {
    try {
      const { error } = await resend.batch.send(
        batch.map((email) => ({
          from: fromEmail,
          to: [email],
          subject: "Nouveau stock de kombucha disponible !",
          html,
        }))
      );
      if (error) {
        console.error("[notifications:email] echec de la diffusion", error);
      } else {
        sent += batch.length;
      }
    } catch (err) {
      console.error("[notifications:email] echec de la diffusion", err);
    }
  }

  return { sent };
}
